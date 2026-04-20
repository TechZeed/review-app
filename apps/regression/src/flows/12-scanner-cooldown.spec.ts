import { test, expect, request as pwRequest } from "@playwright/test";
import crypto from "node:crypto";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// Spec 12 — review cooldown enforcement (PRD 06 / spec 06).
//
// Reality check:
//   - Cooldown is keyed by **phone hash + profile_id within
//     REVIEW_COOLDOWN_DAYS (7)**.
//   - It's enforced at TWO points: /verification/otp/send
//     (verification.service.ts:78) AND /reviews/submit
//     (review.service.ts:106). Either may fire DUPLICATE_REVIEW (429).
//   - deviceFingerprint is captured but does NOT participate in the
//     duplicate check today (gap, see docs/specs/19-device-fingerprint-fix.md).
//
// So the requested "different fingerprint Y still succeeds" assertion is
// trivially true — fingerprint isn't part of the cooldown key. We therefore
// test what the API actually enforces:
//   1. First scan + submit with phone P -> success
//   2. Second scan + submit with same phone P on same profile -> 429 DUPLICATE_REVIEW
//   3. Second scan + submit with different phone P2 -> success (cooldown is
//      per-phone, so a new caller is unblocked)
//
// Cleanup: delete every review row this test created.

const MOCK_OTP = "700000"; // digits sum to 7
const PRIYA_SLUG = "priya-sharma";
const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

type Api = Awaited<ReturnType<typeof pwRequest.newContext>>;

async function scanSubmit(api: Api, phoneSuffix: string, deviceFingerprint: string) {
  const scanRes = await api.post(`${API_URL}/api/v1/reviews/scan/${PRIYA_SLUG}`, {
    data: { deviceFingerprint },
  });
  if (scanRes.status() === 429) {
    return { stage: "scan-rate-limit" as const, status: 429, body: await scanRes.json() };
  }
  expect(scanRes.ok(), `scan failed: ${scanRes.status()} ${await scanRes.text()}`).toBe(true);
  const scanBody = await scanRes.json();
  const reviewToken: string = scanBody.reviewToken ?? scanBody.review_token;
  expect(reviewToken).toBeTruthy();

  // Send + verify OTP — the verification module persists phoneHash on the
  // token at verify time (review.service.ts:103), which is what the cooldown
  // check reads from.
  // Cooldown can fire at otp/send OR /submit — return the first 4xx.
  const sendRes = await api.post(`${API_URL}/api/v1/verification/otp/send`, {
    data: { phone: phoneSuffix, reviewToken, channel: "sms" },
  });
  if (sendRes.status() >= 400) {
    return {
      stage: "otp-send" as const,
      status: sendRes.status(),
      body: await sendRes.json().catch(() => ({})),
    };
  }

  const verifyRes = await api.post(`${API_URL}/api/v1/verification/otp/verify`, {
    data: { phone: phoneSuffix, otp: MOCK_OTP, reviewToken },
  });
  if (verifyRes.status() >= 400) {
    return {
      stage: "otp-verify" as const,
      status: verifyRes.status(),
      body: await verifyRes.json().catch(() => ({})),
    };
  }

  const submitRes = await api.post(`${API_URL}/api/v1/reviews/submit`, {
    data: {
      reviewToken,
      qualities: ["expertise", "care"],
      qualityDisplayOrder: ["expertise", "care", "delivery", "initiative", "trust"],
      thumbsUp: true,
    },
  });
  return {
    stage: "submit" as const,
    status: submitRes.status(),
    body: await submitRes.json().catch(() => ({})),
  };
}

async function getProfileId(): Promise<string> {
  const { rows } = await dbCtx.client.query<{ id: string }>(
    "SELECT id FROM profiles WHERE slug = $1",
    [PRIYA_SLUG],
  );
  expect(rows.length).toBe(1);
  return rows[0].id;
}

async function cleanupRecentReviews(profileId: string, since: Date) {
  const { rows } = await dbCtx.client.query<{ id: string }>(
    `SELECT id FROM reviews WHERE profile_id = $1 AND created_at >= $2`,
    [profileId, since.toISOString()],
  );
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  await dbCtx.client.query("DELETE FROM review_media WHERE review_id = ANY($1::uuid[])", [ids]);
  await dbCtx.client.query("DELETE FROM reviews WHERE id = ANY($1::uuid[])", [ids]);
}

test.describe("scanner cooldown (api)", () => {
  test("duplicate phone within 7 days is rejected; new phone is accepted", async () => {
    // Pre-flight rate probe so we skip cleanly if the IP is throttled.
    const probe = await (await pwRequest.newContext()).post(
      `${API_URL}/api/v1/reviews/scan/${PRIYA_SLUG}`,
      { data: { deviceFingerprint: "regression-rate-probe-12" } },
    );
    if (probe.status() === 429) {
      test.skip(true, "review scan rate-limit exhausted (10/hr/IP)");
    }

    const api = await pwRequest.newContext();
    const profileId = await getProfileId();
    const startedAt = new Date();

    // Unique phone + fingerprint per test run, so we don't collide with
    // earlier cooldown rows lingering from manual testing.
    const runId = crypto.randomBytes(3).toString("hex");
    // E.164 — verification.validation.ts requires `^\+[1-9]\d{6,14}$`.
    const tail = Date.now().toString().slice(-7);
    const phoneA = `+9199${tail}`;
    const phoneB = `+9188${tail}`;
    // deviceFingerprint min length 16 (initiateSchema).
    const fpX = `regression-12-x-${runId}-aaaaaaaa`;
    const fpY = `regression-12-y-${runId}-bbbbbbbb`;

    // (1) First submit with phone A — should succeed.
    const first = await scanSubmit(api, phoneA, fpX);
    if (first.stage === "scan-rate-limit") test.skip(true, "rate-limit during run");
    expect(first.status, `first submit body=${JSON.stringify(first.body)}`).toBeLessThan(400);

    // (2) Second submit with phone A on same profile — should hit
    // DUPLICATE_REVIEW (429), either at /verification/otp/send or
    // /reviews/submit (both check the same `reviews.reviewer_phone_hash`).
    const second = await scanSubmit(api, phoneA, fpX);
    if (second.stage === "scan-rate-limit") test.skip(true, "rate-limit during run");
    expect(second.status).toBe(429);
    expect(second.body?.code ?? second.body?.error?.code).toBe("DUPLICATE_REVIEW");
    expect(["otp-send", "submit"]).toContain(second.stage);

    // (3) Different phone B (different fingerprint Y) — cooldown does NOT
    // apply; the new caller is unblocked. This is the "spec gap" version
    // of the requested assertion: today the API uses phone, not fingerprint.
    const third = await scanSubmit(api, phoneB, fpY);
    if (third.stage === "scan-rate-limit") test.skip(true, "rate-limit during run");
    expect(third.status, `third submit body=${JSON.stringify(third.body)}`).toBeLessThan(400);

    await cleanupRecentReviews(profileId, startedAt);
    await api.dispose();
  });
});
