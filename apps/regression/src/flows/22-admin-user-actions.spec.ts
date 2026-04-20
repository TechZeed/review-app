import { test, expect } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";
import type { Client } from "pg";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

type UserState = {
  id: string;
  role: "INDIVIDUAL" | "EMPLOYER" | "RECRUITER" | "ADMIN";
  status: "active" | "suspended";
};

async function withDbProxy<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  return fn(dbCtx.client);
}

async function getUserState(email: string): Promise<UserState> {
  const { rows } = await withDbProxy((client) =>
    client.query<UserState>("SELECT id, role, status FROM users WHERE email = $1", [email]),
  );
  if (!rows.length) throw new Error(`no user row for ${email}`);
  return rows[0];
}

test.describe("admin user actions (ui)", () => {
  test("admin changes priya role via Users tab dropdown", async ({ page }) => {
    const original = await getUserState("priya@reviewapp.demo");
    const targetRole: UserState["role"] =
      original.role === "EMPLOYER" ? "INDIVIDUAL" : "EMPLOYER";

    try {
      await page.goto("/login");
      await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {});
      await page.goto("/admin");
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("admin-tab-users").click();

      const row = page
        .getByTestId("admin-user-row")
        .filter({ hasText: "priya@reviewapp.demo" });
      await expect(row).toBeVisible({ timeout: 10_000 });

      const roleSelect = row.getByTestId("admin-role-select");
      await roleSelect.selectOption(targetRole);
      await expect(roleSelect).toHaveValue(targetRole, { timeout: 10_000 });

      const updated = await getUserState("priya@reviewapp.demo");
      expect(updated.role).toBe(targetRole);
    } finally {
      await withDbProxy((client) =>
        client.query("UPDATE users SET role = $1 WHERE id = $2", [original.role, original.id]),
      );
    }
  });

  test("admin suspends and re-activates priya via Users tab toggle", async ({ page }) => {
    const original = await getUserState("priya@reviewapp.demo");

    try {
      await page.goto("/login");
      await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {});
      await page.goto("/admin");
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("admin-tab-users").click();

      const row = page
        .getByTestId("admin-user-row")
        .filter({ hasText: "priya@reviewapp.demo" });
      await expect(row).toBeVisible({ timeout: 10_000 });

      const toggle = row.getByTestId("admin-status-toggle");
      const firstExpectedLabel = original.status === "active" ? "Suspend" : "Activate";
      const firstExpectedStatus: UserState["status"] =
        original.status === "active" ? "suspended" : "active";
      const secondExpectedLabel = firstExpectedStatus === "active" ? "Suspend" : "Activate";

      await expect(toggle).toHaveText(firstExpectedLabel);
      page.once("dialog", (dialog) => dialog.accept());
      await toggle.click();
      await expect(toggle).toHaveText(secondExpectedLabel, { timeout: 10_000 });

      const afterFirstToggle = await getUserState("priya@reviewapp.demo");
      expect(afterFirstToggle.status).toBe(firstExpectedStatus);

      page.once("dialog", (dialog) => dialog.accept());
      await toggle.click();
      await expect(toggle).toHaveText(firstExpectedLabel, { timeout: 10_000 });

      const afterSecondToggle = await getUserState("priya@reviewapp.demo");
      expect(afterSecondToggle.status).toBe(original.status);
    } finally {
      await withDbProxy((client) =>
        client.query("UPDATE users SET status = $1 WHERE id = $2", [original.status, original.id]),
      );
    }
  });
});
