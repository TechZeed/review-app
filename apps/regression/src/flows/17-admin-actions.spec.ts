import { test, expect, request } from "@playwright/test";
import { loginAs } from "../lib/auth.js";
import { primeDashboardSession } from "../lib/browserAuth.js";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// Spec 17 (regression) — Admin actions via the UI.
//
// 05-role-upgrade.spec.ts already covers role-request approval via the API.
// This file covers the same outcome through the AdminPage (apps/ui)
// browser flow, plus the reject path. UI affordances for direct role-edit
// or user-suspend in the users tab don't exist today (AdminPage.tsx renders
// a read-only table) — those tests are filed as gaps and skipped.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

async function getUserId(email: string): Promise<string> {
  const { rows } = await dbCtx.client.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1",
    [email],
  );
  if (!rows.length) throw new Error(`no user row for ${email}`);
  return rows[0].id;
}

async function clearPendingRequests(userId: string): Promise<void> {
  await dbCtx.client.query(
    "DELETE FROM role_requests WHERE user_id = $1 AND status = 'pending'",
    [userId],
  );
}

async function createPriyaRequest(): Promise<{ id: string; priyaId: string }> {
  const api = await request.newContext({ baseURL: API_URL });
  try {
    const priyaId = await getUserId("priya@reviewapp.demo");
    await clearPendingRequests(priyaId);
    const { accessToken } = await loginAs(api, "priya@reviewapp.demo");
    const res = await api.post("/api/v1/auth/role-request", {
      headers: { authorization: `Bearer ${accessToken}` },
      data: {
        requestedRole: "EMPLOYER",
        companyName: "Regression Co",
        companyWebsite: "https://regression.example.com",
        reason: "Automated regression — admin UI approve/reject flow.",
      },
    });
    if (!res.ok()) {
      throw new Error(`role-request create failed: ${res.status()} ${await res.text()}`);
    }
    const body = await res.json();
    const id: string = body.id ?? body.roleRequestId ?? body.roleRequest?.id;
    if (!id) throw new Error("role-request response missing id");
    return { id, priyaId };
  } finally {
    await api.dispose();
  }
}

test.describe("admin actions (ui)", () => {
  test("admin approves a role request via /admin Requests tab", async ({ page }) => {
    const { id: requestId, priyaId } = await createPriyaRequest();

    try {
      await page.goto("/login");
      await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {
        // Admin's DashboardRoute redirects to /admin — primeDashboardSession's
        // wait for `dashboard-root` won't resolve. Swallow and continue.
      });
      await page.goto("/admin");
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("admin-tab-requests").click();

      // Find the row for our newly-created request. Rows render the
      // userId prefix (first 8 chars) — anchor on that to disambiguate
      // from other in-flight requests another agent might have left.
      const row = page
        .getByTestId("admin-role-request-row")
        .filter({ hasText: priyaId.slice(0, 8) });
      await expect(row).toBeVisible({ timeout: 10_000 });

      await row.getByTestId("admin-approve-btn").click();

      // Optimistic transition: row disappears (server filters approved
      // requests out) or its approve button vanishes.
      await expect(row.getByTestId("admin-approve-btn")).toBeHidden({ timeout: 10_000 });

      // DB assertion: request approved + priya promoted to EMPLOYER.
      const { rows: reqRows } = await dbCtx.client.query<{ status: string }>(
        "SELECT status FROM role_requests WHERE id = $1",
        [requestId],
      );
      expect(reqRows[0]?.status).toBe("approved");

      const { rows: userRows } = await dbCtx.client.query<{ role: string }>(
        "SELECT role FROM users WHERE id = $1",
        [priyaId],
      );
      expect(userRows[0]?.role).toBe("EMPLOYER");
    } finally {
      // Cleanup — restore priya to INDIVIDUAL and remove the request row
      // so subsequent runs (and other agents' suites) start clean.
      await dbCtx.client.query("DELETE FROM role_requests WHERE id = $1", [requestId]);
      await dbCtx.client.query(
        "UPDATE users SET role = 'INDIVIDUAL' WHERE id = $1",
        [priyaId],
      );
    }
  });

  test("admin rejects a role request — status flips, role unchanged", async ({ page }) => {
    const { id: requestId, priyaId } = await createPriyaRequest();

    try {
      await page.goto("/login");
      await primeDashboardSession(page, "admin@reviewapp.demo").catch(() => {});
      await page.goto("/admin");
      await expect(page.getByTestId("admin-root")).toBeVisible({ timeout: 15_000 });
      await page.getByTestId("admin-tab-requests").click();

      const row = page
        .getByTestId("admin-role-request-row")
        .filter({ hasText: priyaId.slice(0, 8) });
      await expect(row).toBeVisible({ timeout: 10_000 });

      await row.getByTestId("admin-reject-btn").click();

      await expect(row.getByTestId("admin-reject-btn")).toBeHidden({ timeout: 10_000 });

      const { rows: reqRows } = await dbCtx.client.query<{ status: string }>(
        "SELECT status FROM role_requests WHERE id = $1",
        [requestId],
      );
      expect(reqRows[0]?.status).toBe("rejected");

      const { rows: userRows } = await dbCtx.client.query<{ role: string }>(
        "SELECT role FROM users WHERE id = $1",
        [priyaId],
      );
      // Reject must NOT promote.
      expect(userRows[0]?.role).toBe("INDIVIDUAL");
    } finally {
      await dbCtx.client.query("DELETE FROM role_requests WHERE id = $1", [requestId]);
      await dbCtx.client.query(
        "UPDATE users SET role = 'INDIVIDUAL' WHERE id = $1",
        [priyaId],
      );
    }
  });

  // GAP — see docs/specs/31-admin-user-actions-ui.md
  // AdminPage users tab is read-only today (no role dropdown, no suspend
  // button). Backend endpoints exist (PATCH /auth/admin/users/:id and
  // /status), but no UI surfaces them. Skip until the table grows
  // editable cells.
  test.skip("admin edits a user role inline via Users tab", async () => {
    // Pending UI: row-level role select in AdminPage.tsx Users table.
  });

  test.skip("admin suspends a user via Users tab", async () => {
    // Pending UI: row-level suspend/activate button in AdminPage.tsx Users table.
  });
});
