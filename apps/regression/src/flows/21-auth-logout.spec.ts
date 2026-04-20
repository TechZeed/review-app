import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Cross-cutting auth regression:
//   1. Logout clears session and bounces to /login.
//   2. Protected routes redirect anonymous users to /login.

test.describe("auth — logout + protected route guards", () => {
  test("ramesh logs out: localStorage cleared, /dashboard re-bounces to /login", async ({
    page,
  }) => {
    await primeDashboardSession(page, "ramesh@reviewapp.demo");
    await expect(page.getByTestId("dashboard-root")).toBeVisible({ timeout: 15_000 });

    // Sanity — auth_user is set.
    const before = await page.evaluate(() => localStorage.getItem("auth_user"));
    expect(before, "auth_user should be set after primeDashboardSession").toBeTruthy();

    await page.getByTestId("navbar-logout").click();

    // Logout removes auth_user and ProtectedRoute redirects to /login.
    await page.waitForURL(/\/login(\?|$)/, { timeout: 15_000 });
    const after = await page.evaluate(() => localStorage.getItem("auth_user"));
    expect(after, "auth_user should be cleared on logout").toBeNull();

    // Attempting /dashboard again should bounce back to /login.
    await page.goto("/dashboard");
    await page.waitForURL(/\/login(\?|$)/, { timeout: 15_000 });
  });

  test("anonymous visits to protected routes all redirect to /login", async ({ page }) => {
    // Fresh context — no auth_user in storage.
    await page.goto("/login");
    await page.evaluate(() => localStorage.removeItem("auth_user"));

    const protectedPaths = ["/dashboard", "/admin", "/billing", "/recruiter", "/employer"];
    for (const path of protectedPaths) {
      await page.goto(path);
      await page.waitForURL(/\/login(\?|$)/, { timeout: 15_000 });
      expect(page.url(), `expected ${path} to bounce to /login`).toMatch(/\/login(\?|$)/);
    }
  });
});
