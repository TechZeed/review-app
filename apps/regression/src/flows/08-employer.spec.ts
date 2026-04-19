import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Employer dashboard UI smoke (spec 13).
//
// Seeded employer (james@reviewapp.demo, role EMPLOYER) lands on /employer
// with three tabs: References inbox (default), Team reviews, Organization.
// Admins can also reach the page (the page-level guard allows EMPLOYER|ADMIN).
// Individuals (ramesh) get bounced to /dashboard by the role guard.
//
// Note: the employer-side approve/decline reference endpoint does not exist
// yet (see EmployerPage.tsx "API GAPS" comment). The References inbox tab
// renders retention signals as a stand-in; we only assert the container is
// visible — the row count is data-dependent and may be zero.

test.describe("employer page", () => {
  test("employer lands on /employer with all three tabs and references default", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "james@reviewapp.demo").catch(() => {
      // james is EMPLOYER, so DashboardRoute renders DashboardPage and
      // primeDashboardSession's wait for `dashboard-root` should succeed.
      // Catch defensively in case the seed promotes him later.
    });
    await page.goto("/employer");

    await expect(page.getByTestId("employer-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("heading", { name: /employer dashboard/i })).toBeVisible();

    await expect(page.getByTestId("employer-tab-references")).toBeVisible();
    await expect(page.getByTestId("employer-tab-team")).toBeVisible();
    await expect(page.getByTestId("employer-tab-org")).toBeVisible();

    // Default tab is References inbox — the panel container should be rendered.
    await expect(page.getByTestId("employer-references")).toBeVisible();

    // Switch to Team tab — container/heading should render whether populated or empty.
    await page.getByTestId("employer-tab-team").click();
    await expect(page.getByTestId("employer-team")).toBeVisible();
    await expect(page.getByRole("heading", { name: /team members/i })).toBeVisible();
  });

  test("admin can reach /employer", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {
      // Admin's DashboardRoute redirects to /admin; wait for dashboard-root will fail. Swallow.
    });
    await page.goto("/employer");
    await expect(page.getByTestId("employer-root")).toBeVisible({ timeout: 15_000 });
  });

  test("individual is redirected away from /employer", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "ramesh@reviewapp.demo");
    await page.goto("/employer");
    // EmployerPage internal guard sends INDIVIDUAL to /dashboard.
    await page.waitForURL(/\/dashboard$/, { timeout: 10_000 });
  });
});
