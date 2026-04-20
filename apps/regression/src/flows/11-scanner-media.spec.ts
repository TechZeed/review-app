import { test, expect } from "@playwright/test";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// Spec 11 — media prompt step after a scanner review submits.
//
// Flow: rate qualities -> phone -> OTP -> /reviews/submit OK -> MediaPrompt
// (apps/web/src/components/MediaPrompt.tsx) is rendered before ThankYou.
// MediaPrompt offers Text / Voice / Video / Done. Voice + Video are stubbed
// (disabled buttons in the component). Text fires a fetch to add media.
//
// Important contract gap discovered while writing this:
//   - MediaPrompt.tsx posts to `/api/v1/reviews/:reviewId/media`
//   - The API only exposes `POST /api/v1/media/upload` (apps/api/src/modules/
//     media/media.routes.ts).
//   - On top of that, MediaController is constructed with a null repository
//     (`new MediaRepository(null as any)`) so even hitting the right path
//     would not persist a `review_media` row in dev.
// Both gaps are documented in docs/specs/33-scanner-media-persistence.md
// (GH issue filed). Until that ships, the "DB row exists after text submit"
// assertion is `test.skip`'d. The UI-level transitions still get coverage.
//
// Cleanup: the parent review row is created by /reviews/submit — we DELETE
// it (and any review_media that may have been linked) by id before exit.

const MOCK_OTP = "700000"; // see verification.service.ts (digit sum = 7)
const PRIYA_SLUG = "priya-sharma";
const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

async function rateLimitProbeOrSkip(request: any) {
  const probe = await request.post(`${API_URL}/api/v1/reviews/scan/${PRIYA_SLUG}`, {
    data: { deviceFingerprint: "regression-rate-probe-11" },
  });
  if (probe.status() === 429) {
    test.skip(true, "review scan rate-limit exhausted (10/hr/IP) — try again later");
  }
}

async function getProfileId(): Promise<string> {
  const { rows } = await dbCtx.client.query<{ id: string }>(
    "SELECT id FROM profiles WHERE slug = $1",
    [PRIYA_SLUG],
  );
  expect(rows.length).toBe(1);
  return rows[0].id;
}

async function rateUntilMediaStep(page: any) {
  await page.goto(`/r/${PRIYA_SLUG}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/priya/i);

  await page.getByRole("checkbox", { name: /expertise quality/i }).click();
  await page.getByRole("checkbox", { name: /care quality/i }).click();
  await page.getByRole("button", { name: /submit review/i }).click();

  const phoneSuffix = String(Date.now()).slice(-7);
  await page.getByLabel(/phone number/i).fill(phoneSuffix);
  await page.getByRole("button", { name: /send code/i }).click();

  const digitInputs = page.locator('input[aria-label^="Digit "]');
  await expect(digitInputs.first()).toBeVisible({ timeout: 10_000 });
  for (let i = 0; i < 6; i++) await digitInputs.nth(i).fill(MOCK_OTP[i]);

  // MediaPrompt renders "Review saved!" heading, then auto-dismisses to
  // ThankYou after 3s unless interaction resets the timer.
  await expect(page.getByRole("heading", { name: /review saved/i })).toBeVisible({
    timeout: 20_000,
  });
}

async function cleanupRecentReviews(profileId: string, since: Date) {
  const { rows } = await dbCtx.client.query<{ id: string }>(
    `SELECT id FROM reviews WHERE profile_id = $1 AND created_at >= $2`,
    [profileId, since.toISOString()],
  );
  if (!rows.length) return;
  const ids = rows.map((r) => r.id);
  // Cascade should drop review_media rows. Delete defensively anyway.
  await dbCtx.client.query("DELETE FROM review_media WHERE review_id = ANY($1::uuid[])", [ids]);
  await dbCtx.client.query("DELETE FROM reviews WHERE id = ANY($1::uuid[])", [ids]);
}

test.describe("scanner media prompt (browser)", () => {
  test("media prompt is visible after OTP submit", async ({ page, request }) => {
    await rateLimitProbeOrSkip(request);
    const profileId = await getProfileId();
    const startedAt = new Date();

    await rateUntilMediaStep(page);

    // Three CTAs (text/voice/video) + Done all live in MediaPrompt.
    await expect(page.getByRole("button", { name: /add text review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add voice review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add video review/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /skip additional feedback/i })).toBeVisible();

    await cleanupRecentReviews(profileId, startedAt);
  });

  test("Done (skip) advances to thank-you with no media row", async ({ page, request }) => {
    await rateLimitProbeOrSkip(request);
    const profileId = await getProfileId();
    const startedAt = new Date();

    await rateUntilMediaStep(page);
    await page.getByRole("button", { name: /skip additional feedback/i }).click();
    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible({
      timeout: 10_000,
    });

    // Confirm no review_media row was attached to the just-created review.
    const { rows: createdReviews } = await dbCtx.client.query<{ id: string }>(
      `SELECT id FROM reviews WHERE profile_id = $1 AND created_at >= $2`,
      [profileId, startedAt.toISOString()],
    );
    if (createdReviews.length) {
      const ids = createdReviews.map((r) => r.id);
      const { rows: mediaRows } = await dbCtx.client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM review_media WHERE review_id = ANY($1::uuid[])`,
        [ids],
      );
      expect(Number(mediaRows[0].count)).toBe(0);
    }

    await cleanupRecentReviews(profileId, startedAt);
  });

  test("Add text review persists a review_media row", async ({ page, request }) => {
    test.skip(
      true,
      "Blocked by spec 33 / issue #13 — MediaPrompt POSTs to /reviews/:id/media (404). API only exposes /media/upload, and MediaController repo is null.",
    );

    await rateLimitProbeOrSkip(request);
    const profileId = await getProfileId();
    const startedAt = new Date();

    await rateUntilMediaStep(page);
    await page.getByRole("button", { name: /add text review/i }).click();
    const textArea = page.getByRole("textbox");
    await textArea.fill("Regression text review — auto-cleanup");
    await page.getByRole("button", { name: /^add$/i }).click();

    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible({
      timeout: 10_000,
    });

    const { rows: reviewRows } = await dbCtx.client.query<{ id: string }>(
      `SELECT id FROM reviews WHERE profile_id = $1 AND created_at >= $2`,
      [profileId, startedAt.toISOString()],
    );
    expect(reviewRows.length).toBeGreaterThanOrEqual(1);
    const ids = reviewRows.map((r) => r.id);
    const { rows: mediaRows } = await dbCtx.client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM review_media WHERE review_id = ANY($1::uuid[])`,
      [ids],
    );
    expect(Number(mediaRows[0].count)).toBeGreaterThanOrEqual(1);

    await cleanupRecentReviews(profileId, startedAt);
  });
});
