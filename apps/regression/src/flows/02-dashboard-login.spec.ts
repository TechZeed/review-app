import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Browser-side regression for the logged-in dashboard surface. Drives
// auth through the API + localStorage seeding (see browserAuth.ts) rather
// than the UI form, because the deployed dashboard bundle may not
// include the VITE_FEATURE_EMAIL_LOGIN button until the next UI redeploy.
// The separate API-level login smoke (00-smoke.spec.ts) already covers
// the /api/v1/auth/login endpoint directly.

test.describe("dashboard login (browser)", () => {
  test("ramesh lands on dashboard with NavBar and reviews visible", async ({ page }) => {
    await primeDashboardSession(page, "ramesh@reviewapp.demo");

    // NavBar renders with the user's sign-out affordance once auth is set.
    await expect(page.getByTestId("nav-bar")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible();

    // Public Profile link must resolve to the user's slug, not an empty
    // /profile/ path (regression: LoginPage previously hardcoded profile_slug='').
    const publicLink = page.getByTestId("nav-bar").getByRole("link", { name: /public profile|^profile$/i });
    await expect(publicLink).toBeVisible();
    const href = await publicLink.getAttribute("href");
    expect(href, "Public Profile href must include a slug").toMatch(/\/profile\/ramesh-kumar$/);

    // At least one review card in the recent-reviews feed. Ramesh is
    // seeded with 150 reviews; UI paginates but the first page always
    // has ≥1.
    const feed = page.getByRole("feed", { name: /recent reviews/i });
    await expect(feed).toBeVisible({ timeout: 15_000 });
    const cards = feed.locator("> *");
    expect(await cards.count()).toBeGreaterThan(0);
    await expect(cards.first()).toBeVisible();
  });

  const profileUsers = [
    "james@reviewapp.demo",
    "rachel@reviewapp.demo",
    "admin@reviewapp.demo",
    "ramesh@reviewapp.demo",
  ] as const;

  for (const email of profileUsers) {
    test(`${email} sees dashboard profile card without API permission error`, async ({ page }) => {
      await primeDashboardSession(page, email);

      await expect(page.getByTestId("profile-card")).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/failed to load profile/i)).toHaveCount(0);
      await expect(page.getByText(/api error 403/i)).toHaveCount(0);
      await expect(page.getByText(/insufficient permissions/i)).toHaveCount(0);
    });
  }
});
