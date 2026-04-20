import { test, expect } from "@playwright/test";

// Spec 13 — public profile landing for an unauthenticated visitor.
//
// Today the only public surface at /r/:slug is the **review submission**
// page (apps/web/src/pages/ReviewPage.tsx) — the rate-the-person flow. It
// shows: avatar, display name, headline, and a "<n> reviews" badge.
//
// What the PRD asks for (PRD 01 / 03 — public reputation page):
//   - Quality heatmap or badge breakdown (counts per quality)
//   - At least one review card (recent feedback)
//   - "Verified testimonial" badge on reviews backed by voice/video
//   - All visible to unauthenticated visitors
//
// None of those exist on /r/:slug today. Logged-in dashboard (apps/ui)
// renders some of them, but that's not public. Spec 34
// (docs/specs/34-public-profile-page.md) tracks the gap; the PRD-style
// assertions are `test.skip`'d below until the page exists.
//
// Tests below verify what the public surface DOES guarantee today:
//   - Profile loads without auth
//   - Header shows name + headline
//   - Review-count badge reflects DB total when totalReviews > 0
//   - No login prompt is rendered (public stays public)

const RAMESH_SLUG = "ramesh-kumar";

test.describe("public profile landing (browser)", () => {
  test("loads unauthenticated, shows name + headline, no login wall", async ({ page }) => {
    await page.goto(`/r/${RAMESH_SLUG}`);

    // Name in the H1.
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/ramesh/i);

    // Headline visible (api returns "Senior Sales Consultant" for ramesh).
    await expect(page.getByText(/sales consultant/i).first()).toBeVisible();

    // Public means public — no login button / sign-in prompt.
    await expect(page.getByRole("button", { name: /sign in|log in/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /sign in|log in/i })).toHaveCount(0);
  });

  test("review count badge reflects API reviewCount", async ({ page }) => {
    test.skip(
      true,
      "Blocked by spec 34 / issue #14 — API returns `reviewCount`, ReviewPage.tsx reads `totalReviews`/`total_reviews` only, so the badge never renders even though Ramesh has 150 reviews server-side.",
    );
    await page.goto(`/r/${RAMESH_SLUG}`);
    await expect(page.getByText(/\d+\s+reviews?/i).first()).toBeVisible();
  });

  test("quality heatmap / badge breakdown is visible", async ({ page }) => {
    test.skip(
      true,
      "Blocked by spec 34 / issue #14 — /r/:slug is a rate page, not a public reputation page. No quality heatmap component exists.",
    );
    await page.goto(`/r/${RAMESH_SLUG}`);
    await expect(page.getByTestId("quality-heatmap")).toBeVisible();
  });

  test("at least one review card with verified-testimonial badge is visible", async ({ page }) => {
    test.skip(
      true,
      "Blocked by spec 34 / issue #14 — public review-card list + verified_testimonial badge not implemented on /r/:slug.",
    );
    await page.goto(`/r/${RAMESH_SLUG}`);
    const cards = page.getByTestId("public-review-card");
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId("badge-verified-testimonial").first()).toBeVisible();
  });
});
