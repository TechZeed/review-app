import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Admin UI smoke. Seeded admin@reviewapp.demo lands on /admin (not the
// reviewee dashboard), sees the two tabs, and the users list is populated.

test.describe("admin page", () => {
  test("admin lands on /admin with role-requests + users tabs", async ({ page }) => {
    // primeDashboardSession writes auth_user then navigates to /dashboard.
    // For admins, DashboardRoute redirects to /admin — follow.
    await page.goto("/login");
    await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {
      // primeDashboardSession waits for `dashboard-root` which admin never
      // reaches; swallow and continue — we'll assert /admin below.
    });
    await page.goto("/admin");

    await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /^Admin$/i })).toBeVisible();
    await expect(page.getByTestId("admin-tab-requests")).toBeVisible();
    await expect(page.getByTestId("admin-tab-users")).toBeVisible();

    // Switch to users tab — list should render (dev seed has 12 users).
    await page.getByTestId("admin-tab-users").click();
    const rows = page.getByTestId("admin-user-row");
    await expect(rows.first()).toBeVisible({ timeout: 10_000 });
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test("non-admin redirected away from /admin", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "ramesh@reviewapp.demo");
    await page.goto("/admin");
    // Ramesh is INDIVIDUAL → AdminPage internal guard sends him to /dashboard.
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  });
});
