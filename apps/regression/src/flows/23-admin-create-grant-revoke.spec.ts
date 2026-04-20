import { test, expect, request, type Page } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";
import { randomUUID } from "node:crypto";
import { loginAs } from "../lib/auth.js";

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

async function withDbProxy<T>(fn: (ctx: DbCtx) => Promise<T>): Promise<T> {
  return fn(dbCtx);
}

async function openAdminUsersTab(page: Page): Promise<void> {
  await page.goto("/login");
  try {
    await primeDashboardSession(page, "admin@reviewapp.demo");
  } catch {
    // Admin can be redirected to /admin before dashboard-root appears.
  }
  await page.goto("/admin");
  await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
  await page.getByTestId("admin-tab-users").click();
}

test.describe("admin create + grant + revoke capability", () => {
  test("admin creates a user via UI and DB row exists", async ({ page }) => {
    const email = `spec44+${randomUUID()}@reviewapp.demo`;

    await openAdminUsersTab(page);
    await page.getByTestId("admin-create-user-btn").click();
    await page.getByTestId("admin-create-user-form").getByLabel(/email/i).fill(email);
    await page.getByTestId("admin-create-user-form").getByLabel(/name/i).fill("Spec 44 User");
    await page.getByTestId("admin-create-user-form").getByLabel(/password/i).fill("Spec44_Create_1234");
    await page.getByTestId("admin-create-user-form").getByLabel(/phone/i).fill("+6591234567");
    await page.getByTestId("admin-create-user-submit").click();

    await expect(page.getByTestId("admin-create-user-form")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByTestId("admin-user-row").filter({ hasText: email })).toBeVisible({ timeout: 10_000 });

    const row = await withDbProxy(({ client }) =>
      client.query<{ id: string; email: string }>("SELECT id, email FROM users WHERE email = $1 LIMIT 1", [email]),
    );
    expect(row.rows[0]?.email).toBe(email);

    await withDbProxy(({ client }) => client.query("DELETE FROM users WHERE email = $1", [email]));
  });

  test("admin grants recruiter capability and API reflects it", async ({ page }) => {
    const api = await request.newContext({ baseURL: API_URL });
    const email = `spec44+${randomUUID()}@reviewapp.demo`;
    try {
      const { accessToken } = await loginAs(api, "admin@reviewapp.demo");
      const createRes = await api.post("/api/v1/auth/admin/create-user", {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { email, password: "Spec44_Create_1234", name: "Spec 44 Grant", role: "INDIVIDUAL" },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = (await createRes.json()) as { user: { id: string } };
      const userId = created.user.id;

      await openAdminUsersTab(page);
      const row = page.getByTestId("admin-user-row").filter({ hasText: email });
      await expect(row).toBeVisible({ timeout: 10_000 });
      await row.getByTestId("admin-grant-cap-select").selectOption("recruiter");
      await row.getByTestId("admin-grant-cap-btn").click();
      await expect(row.getByTestId("admin-cap-chip-recruiter")).toBeVisible({ timeout: 10_000 });

      const loginRes = await api.post("/api/v1/auth/login", {
        data: { email, password: "Spec44_Create_1234" },
      });
      expect(loginRes.ok()).toBeTruthy();
      const loginBody = (await loginRes.json()) as { accessToken: string };
      const subRes = await api.get("/api/v1/subscriptions/me", {
        headers: { authorization: `Bearer ${loginBody.accessToken}` },
      });
      expect(subRes.ok()).toBeTruthy();
      const subBody = (await subRes.json()) as { capabilities: Array<{ capability: string }> };
      expect(subBody.capabilities.some((c) => c.capability === "recruiter")).toBeTruthy();

      await withDbProxy(({ client }) => client.query("DELETE FROM users WHERE id = $1", [userId]));
    } finally {
      await api.dispose();
    }
  });

  test("admin revokes recruiter capability and DB marks it expired", async ({ page }) => {
    const api = await request.newContext({ baseURL: API_URL });
    const email = `spec44+${randomUUID()}@reviewapp.demo`;
    try {
      const { accessToken } = await loginAs(api, "admin@reviewapp.demo");
      const createRes = await api.post("/api/v1/auth/admin/create-user", {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { email, password: "Spec44_Create_1234", name: "Spec 44 Revoke", role: "INDIVIDUAL" },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = (await createRes.json()) as { user: { id: string } };
      const userId = created.user.id;

      const grantRes = await api.post(`/api/v1/auth/admin/users/${userId}/capabilities`, {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { capability: "recruiter", reason: "spec44-revoke" },
      });
      expect(grantRes.ok()).toBeTruthy();

      await openAdminUsersTab(page);
      const row = page.getByTestId("admin-user-row").filter({ hasText: email });
      await expect(row).toBeVisible({ timeout: 10_000 });
      const chip = row.getByTestId("admin-cap-chip-recruiter");
      if (!(await chip.isVisible().catch(() => false))) {
        await row.getByTestId("admin-grant-cap-select").selectOption("recruiter");
        await row.getByTestId("admin-grant-cap-btn").click();
        await expect(chip).toBeVisible({ timeout: 10_000 });
      }
      await row.getByTestId("admin-revoke-cap-btn-recruiter").click();
      await expect(row.getByTestId("admin-cap-chip-recruiter")).toBeHidden({ timeout: 10_000 });

      const db = await withDbProxy(({ client }) =>
        client.query<{ expires_at: string | null }>(
          `SELECT expires_at
           FROM user_capabilities
           WHERE user_id = $1 AND capability = 'recruiter'
           ORDER BY granted_at DESC
           LIMIT 1`,
          [userId],
        ),
      );
      expect(db.rows[0]?.expires_at).toBeTruthy();

      await withDbProxy(({ client }) => client.query("DELETE FROM users WHERE id = $1", [userId]));
    } finally {
      await api.dispose();
    }
  });
});
