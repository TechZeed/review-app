import { request, type Page } from "@playwright/test";
import { loginAs } from "./auth.js";

/**
 * Log in via the dashboard UI's email+password form.
 *
 * Requires the deployed UI bundle to include the email-login affordance
 * (VITE_FEATURE_EMAIL_LOGIN=true at build time). If the button isn't
 * present in the DOM, this call will throw on the first `click`.
 *
 * Prefer `primeDashboardSession` in regression specs — it's more robust
 * against a stale UI build — unless the UI form itself is what you want
 * to test.
 */
export async function loginViaEmailForm(
  page: Page,
  email: string,
  password = process.env.DEFAULT_SEED_PASSWORD ?? "Demo123",
): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in with email and password/i }).click();
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await page.waitForURL(/\/dashboard\b/, { timeout: 15_000 });
  await page.getByTestId("dashboard-root").waitFor({ state: "visible" });
}

/**
 * Authenticate against the API and seed the dashboard's localStorage
 * `auth_user` entry (shape defined in apps/ui/src/App.tsx). This is how
 * Playwright avoids depending on the Google popup or the feature-flagged
 * email form — exercise the logged-in UI surface area directly.
 *
 * Navigates to `/dashboard` as a side effect so the page is ready to
 * assert against. Call `page.context().clearCookies()` / clear storage
 * in afterEach if you need a clean slate.
 */
export async function primeDashboardSession(
  page: Page,
  email: string,
  password = process.env.DEFAULT_SEED_PASSWORD ?? "Demo123",
): Promise<{ accessToken: string; userId: string }> {
  const apiUrl = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";
  const api = await request.newContext({ baseURL: apiUrl });
  try {
    const { accessToken, user } = await loginAs(api, email);
    // Spec 28 — `auth_user.capabilities: string[]` is required by the new
    // capability-aware NavBar + page guards. Fetch /subscriptions/me to
    // populate it; fall back to `[]` so a 500 (e.g. transient backend
    // hiccup) doesn't cascade into test-harness noise.
    let capabilities: string[] = [];
    try {
      const meRes = await api.get("/api/v1/subscriptions/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      if (meRes.ok()) {
        const me = await meRes.json();
        const caps: Array<{ capability: string }> = me?.capabilities ?? [];
        capabilities = caps.map((c) => c.capability).filter((c): c is string => !!c);
      }
    } catch {
      // Non-fatal — leave capabilities as [].
    }
    let profile_slug = "";
    if (user.role !== "ADMIN") {
      try {
        const profRes = await api.get("/api/v1/profiles/me", {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        if (profRes.ok()) {
          const prof = await profRes.json();
          profile_slug = prof?.slug ?? "";
        }
      } catch {
        // Non-fatal — individuals may not have a profile in edge cases.
      }
    }
    const authUser = {
      token: accessToken,
      id: user.id,
      email: user.email,
      role: user.role,
      name: (user as any).name ?? "",
      profile_slug,
      capabilities,
    };
    // App.tsx reads auth_user on mount (useState initializer). We need the
    // value present before first render, so navigate to a blank page on
    // the dashboard origin first, write localStorage, then hard-navigate
    // to /dashboard.
    await page.goto("/login");
    await page.evaluate((u) => {
      localStorage.setItem("auth_user", JSON.stringify(u));
    }, authUser);
    await page.goto("/dashboard");
    await page.getByTestId("dashboard-root").waitFor({ state: "visible", timeout: 15_000 });
    return { accessToken, userId: user.id };
  } finally {
    await api.dispose();
  }
}
