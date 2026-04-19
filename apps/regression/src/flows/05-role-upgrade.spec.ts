import { test, expect, request } from "@playwright/test";
import { loginAs } from "../lib/auth.js";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// Role-upgrade regression. The spec asks for a browser flow, but the
// dashboard UI (apps/ui/src) has no "become an employer" affordance yet
// (grep for role-request/roleUpgrade/become-employer returns zero
// matches). This spec exercises the backend invariant instead — request
// → pending row → admin approve → approved row — through the HTTP API,
// which is the same contract a future UI will hit.
//
// Skip the end-to-end browser version until the UI ships the form.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

test.describe("role upgrade (api)", () => {
  test("priya requests EMPLOYER → admin approves → DB reflects both states", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    try {
      // Priya's id — used for direct pre-test cleanup in case a previous
      // run left a pending request behind (the API rejects duplicates).
      const { rows: priyaRows } = await dbCtx.client.query<{ id: string }>(
        "SELECT id FROM users WHERE email = $1",
        ["priya@reviewapp.demo"],
      );
      expect(priyaRows.length).toBe(1);
      const priyaId = priyaRows[0].id;

      await dbCtx.client.query(
        "DELETE FROM role_requests WHERE user_id = $1 AND status = 'pending'",
        [priyaId],
      );

      const { accessToken: priyaToken } = await loginAs(api, "priya@reviewapp.demo");

      const createRes = await api.post("/api/v1/auth/role-request", {
        headers: { authorization: `Bearer ${priyaToken}` },
        data: {
          requestedRole: "EMPLOYER",
          companyName: "Regression Co",
          companyWebsite: "https://regression.example.com",
          reason: "Automated regression suite (spec 25) — safe to reject.",
        },
      });
      expect(createRes.ok()).toBeTruthy();
      const created = await createRes.json();
      const requestId: string =
        created.id ?? created.roleRequestId ?? created.roleRequest?.id;
      expect(requestId).toBeTruthy();

      // DB pending row visible.
      const { rows: pendingRows } = await dbCtx.client.query<{ status: string }>(
        "SELECT status FROM role_requests WHERE id = $1",
        [requestId],
      );
      expect(pendingRows.length).toBe(1);
      expect(pendingRows[0].status).toBe("pending");

      // Admin approves.
      const { accessToken: adminToken } = await loginAs(api, "admin@reviewapp.demo");
      const approveRes = await api.post(
        `/api/v1/auth/admin/role-requests/${requestId}/approve`,
        { headers: { authorization: `Bearer ${adminToken}` } },
      );
      expect(approveRes.ok()).toBeTruthy();

      // DB status transitioned.
      const { rows: approvedRows } = await dbCtx.client.query<{ status: string }>(
        "SELECT status FROM role_requests WHERE id = $1",
        [requestId],
      );
      expect(approvedRows[0].status).toBe("approved");

      // Cleanup — remove the request row and revert priya's role if the
      // approval flipped it. Keeps priya as INDIVIDUAL so repeat runs
      // aren't cooked.
      await dbCtx.client.query("DELETE FROM role_requests WHERE id = $1", [requestId]);
      await dbCtx.client.query(
        "UPDATE users SET role = 'INDIVIDUAL' WHERE id = $1",
        [priyaId],
      );
    } finally {
      await api.dispose();
    }
  });

  test.skip("priya submits role-request form from the dashboard (browser)", async () => {
    // Blocked: apps/ui/src has no role-request UI yet. When the form
    // ships, flip this to a real browser flow — the API-layer test
    // above already covers the contract. Tracking: spec 16 + spec 25.
  });
});
