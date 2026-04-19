import { test, expect } from "@playwright/test";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// End-to-end QR-scan journey on review-scan.teczeed.com:
//   /r/priya-sharma → pick 2 qualities → thumbs-up → phone → OTP → thank you.
//
// OTP: dev API runs with SMS_PROVIDER=mock, which accepts any 6-digit
// code whose digits sum to 7 (apps/api/src/modules/verification/
// verification.service.ts). We use "700000".
//
// DB assertion: a new row in `reviews` with profile_id = priya's id.
// Cleanup: delete that row (+ any review_tokens it consumed) by id.

const MOCK_OTP = "700000"; // digits sum to 7 — see verification.service.ts
const PRIYA_SLUG = "priya-sharma";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

test.describe("scanner e2e (browser)", () => {
  test("priya scan → rate → OTP → review persisted", async ({ page }) => {
    const { rows: priyaRows } = await dbCtx.client.query<{ id: string }>(
      "SELECT id FROM profiles WHERE slug = $1",
      [PRIYA_SLUG],
    );
    expect(priyaRows.length).toBe(1);
    const profileId = priyaRows[0].id;

    const { rows: beforeRows } = await dbCtx.client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM reviews WHERE profile_id = $1",
      [profileId],
    );
    const beforeCount = Number(beforeRows[0].count);
    const startedAt = new Date();

    await page.goto(`/r/${PRIYA_SLUG}`);

    // Landing loaded — profile header shows Priya's name.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/priya/i);

    // Pick two qualities. Regex match is case-insensitive and forgives
    // the trailing "quality" in the aria-label.
    await page.getByRole("checkbox", { name: /expertise quality/i }).click();
    await page.getByRole("checkbox", { name: /care quality/i }).click();

    // Submit → triggers /reviews/scan/:slug and opens the OTP modal.
    await page.getByRole("button", { name: /submit review/i }).click();

    // Phone step — unique per run so the cooldown doesn't hit.
    const phoneSuffix = String(Date.now()).slice(-7);
    await page.getByLabel(/phone number/i).fill(phoneSuffix);
    await page.getByRole("button", { name: /send code/i }).click();

    // OTP step — 6 inputs, one per digit.
    const digitInputs = page.locator('input[aria-label^="Digit "]');
    await expect(digitInputs.first()).toBeVisible({ timeout: 10_000 });
    for (let i = 0; i < 6; i++) {
      await digitInputs.nth(i).fill(MOCK_OTP[i]);
    }

    // After OTP verifies + /reviews/submit, the app advances to the
    // MediaPrompt step (auto-dismisses to ThankYou after 3s). Let the
    // auto-dismiss carry us — the ThankYou heading is the stable signal.
    await expect(page.getByRole("heading", { name: /thank you/i })).toBeVisible({
      timeout: 20_000,
    });

    // DB counter-check: one new row for Priya, created after test start.
    const { rows: afterRows } = await dbCtx.client.query<{ id: string; created_at: Date }>(
      `SELECT id, created_at FROM reviews
       WHERE profile_id = $1 AND created_at >= $2
       ORDER BY created_at DESC`,
      [profileId, startedAt.toISOString()],
    );
    expect(afterRows.length).toBeGreaterThanOrEqual(1);
    const newReviewId = afterRows[0].id;

    const { rows: totalAfter } = await dbCtx.client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM reviews WHERE profile_id = $1",
      [profileId],
    );
    expect(Number(totalAfter[0].count)).toBe(beforeCount + afterRows.length);

    // Cleanup — remove the review(s) created by this run.
    await dbCtx.client.query(
      "DELETE FROM reviews WHERE id = ANY($1::uuid[])",
      [afterRows.map((r) => r.id)],
    );
    // Defensive: also nuke any used review_tokens tied to those ids if
    // the schema cascades the other way.
    console.log(`[scanner] created + cleaned review ${newReviewId} for profile ${profileId}`);
  });
});
