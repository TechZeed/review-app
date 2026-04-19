import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Recruiter UI smoke. Seeded rachel@reviewapp.demo (role RECRUITER) lands
// on /recruiter, sees the search input + filters, can run a query against
// seeded individuals (ramesh-kumar et al.), and gets a non-empty result
// list. Admin can also reach /recruiter; an INDIVIDUAL is bounced.

test.describe("recruiter page", () => {
  test("recruiter sees search input + filters and can search", async ({ page }) => {
    // primeDashboardSession waits for `dashboard-root` which the
    // RecruiterPage internal guard will leave us on (DashboardRoute
    // renders DashboardPage for RECRUITER) but the dashboard fetch may
    // fail for non-INDIVIDUAL roles. Swallow + navigate to /recruiter.
    await page.goto("/login");
    await primeDashboardSession(page, "rachel@reviewapp.demo").catch(() => {});
    await page.goto("/recruiter");

    await expect(page.getByTestId("recruiter-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("recruiter-search-input")).toBeVisible();
    await expect(page.getByTestId("recruiter-filter-quality-expertise")).toBeVisible();
    await expect(page.getByTestId("recruiter-filter-industry")).toBeVisible();

    // Default empty-query state should show some results (visible profiles
    // exist in the seed) OR the empty-state — either is sensible. We just
    // assert the page settled (no spinner).
    await page.waitForFunction(
      () => {
        const root = document.querySelector('[data-testid="recruiter-results"]');
        if (!root) return false;
        return !root.textContent?.toLowerCase().includes("searching");
      },
      null,
      { timeout: 15_000 },
    );

    // Type a query that should match seeded Ramesh (auto-sales / 150
    // reviews). Debounce is 300ms; allow 5s for the result to settle.
    await page.getByTestId("recruiter-search-input").fill("sales");
    await expect
      .poll(async () => await page.getByTestId("recruiter-result-row").count(), { timeout: 10_000 })
      .toBeGreaterThan(0);

    const firstRow = page.getByTestId("recruiter-result-row").first();
    await expect(firstRow.getByTestId("recruiter-contact-btn")).toBeVisible();

    // Clear search — page should show either default results or the
    // empty-state, never stuck in error.
    await page.getByTestId("recruiter-search-input").fill("");
    await expect(page.getByTestId("recruiter-search-input")).toHaveValue("");
    // Wait for debounce + new query to settle.
    await page.waitForTimeout(800);
    const hasError = await page.getByTestId("recruiter-error").isVisible().catch(() => false);
    expect(hasError).toBe(false);
  });

  test("admin can reach /recruiter", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {});
    await page.goto("/recruiter");
    await expect(page.getByTestId("recruiter-root")).toBeVisible({ timeout: 15_000 });
  });

  test("non-recruiter (priya) bounced to /dashboard", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "priya@reviewapp.demo");
    await page.goto("/recruiter");
    // Priya is INDIVIDUAL → RecruiterPage internal guard sends her back.
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  });
});
