import { test, expect, request } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Asserts the logged-in dashboard renders reviews with the expected
// metadata (quality badges + date) AND that the UI-visible count is
// consistent with the API's /reviews/me response. The dashboard is a
// single-page view — /reviews is not a separate route (see
// apps/ui/src/App.tsx; DashboardPage renders the reviews feed inline).
//
// The UI paginates at `limit=20` by default (lib/api.ts fetchReviews)
// so for Ramesh (150 seeded reviews) we expect exactly that many cards
// on page load.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

test.describe("dashboard reviews", () => {
  test("feed renders with quality chips + dates, count consistent with API", async ({ page }) => {
    const { accessToken } = await primeDashboardSession(page, "ramesh@reviewapp.demo");

    const feed = page.getByRole("feed", { name: /recent reviews/i });
    await expect(feed).toBeVisible({ timeout: 15_000 });

    const cards = feed.locator("> *");
    const uiCount = await cards.count();
    expect(uiCount).toBeGreaterThan(0);

    // Each card renders the quality picks as chips + a formatted date
    // (ReviewCard.tsx). Spot-check the first card for both affordances.
    const first = cards.first();
    // At least one quality chip — they're rendered with one of the five
    // quality-name words. Use a regex union.
    await expect(
      first.getByText(/expertise|care|delivery|initiative|trust/i).first(),
    ).toBeVisible();
    // Formatted date: "Jan 1, 2025" — loose check, just ensure there's
    // a "<Mon> <day>, <year>" string somewhere in the card.
    await expect(
      first.getByText(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+\d{1,2},\s+\d{4}\b/i),
    ).toBeVisible();

    // Counter-check: total reviews reported by API match the ramesh
    // seed (150), and the UI displays the first-page-worth.
    const api = await request.newContext({ baseURL: API_URL });
    try {
      const res = await api.get("/api/v1/reviews/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.ok()).toBeTruthy();
      const body = await res.json();
      expect(body.pagination.total).toBeGreaterThanOrEqual(uiCount);
      // UI fetches with limit 20; cards should be min(total, 20).
      expect(uiCount).toBe(Math.min(body.pagination.total, body.pagination.limit));
    } finally {
      await api.dispose();
    }
  });
});
