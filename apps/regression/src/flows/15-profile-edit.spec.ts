import { test, expect, request } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";
import { loginAs } from "../lib/auth.js";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

// Reviewee daily-loop coverage — profile edit (PRD 01: the individual
// owns their profile).
//
// API contract: PUT /api/v1/profiles/me with auth + INDIVIDUAL role
// (apps/api/src/modules/profile/profile.routes.ts). The dashboard UI
// (DashboardPage + ProfileCard) currently has no edit affordance —
// confirmed by grepping apps/ui/src for "edit" / "PATCH /profiles".
//
// We split the test in two:
//   1. API-layer round trip — proves the contract: read → mutate →
//      DB reflects → restore. Always runs.
//   2. Browser flow — skipped with a pointer until the UI ships.
//
// Tracking: docs/specs/26-profile-edit-ui.md (gap spec).

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let dbCtx: DbCtx;

test.beforeAll(async () => {
  dbCtx = await openDb();
});

test.afterAll(async () => {
  if (dbCtx) await closeDb(dbCtx);
});

test.describe("profile edit (spec PRD-01 / GAP)", () => {
  test("ramesh updates headline via API, change persists in DB, restore works", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    try {
      const { accessToken } = await loginAs(api, "ramesh@reviewapp.demo");

      // Snapshot original headline directly from DB so we can restore.
      const { rows: before } = await dbCtx.client.query<{ headline: string | null }>(
        `SELECT p.headline FROM profiles p
           JOIN users u ON u.id = p.user_id
          WHERE u.email = $1`,
        ["ramesh@reviewapp.demo"],
      );
      expect(before.length).toBe(1);
      const original = before[0].headline;

      const testRunId = `regression-${Date.now()}`;
      const newHeadline = `Senior Engineer · ${testRunId}`;

      const updateRes = await api.put("/api/v1/profiles/me", {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { headline: newHeadline },
      });
      expect(updateRes.ok()).toBeTruthy();

      // DB reflects the write.
      const { rows: after } = await dbCtx.client.query<{ headline: string | null }>(
        `SELECT p.headline FROM profiles p
           JOIN users u ON u.id = p.user_id
          WHERE u.email = $1`,
        ["ramesh@reviewapp.demo"],
      );
      expect(after[0].headline).toBe(newHeadline);

      // GET /me returns the new value too — proves the read path is
      // consistent with the write.
      const meRes = await api.get("/api/v1/profiles/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(meRes.ok()).toBeTruthy();
      const me = await meRes.json();
      expect(me.headline).toBe(newHeadline);

      // Restore.
      const restoreRes = await api.put("/api/v1/profiles/me", {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { headline: original ?? "" },
      });
      expect(restoreRes.ok()).toBeTruthy();

      const { rows: restored } = await dbCtx.client.query<{ headline: string | null }>(
        `SELECT p.headline FROM profiles p
           JOIN users u ON u.id = p.user_id
          WHERE u.email = $1`,
        ["ramesh@reviewapp.demo"],
      );
      // Either the original (if it was non-null) or empty string after
      // the restore; just make sure no test-run sentinel leaked.
      expect(restored[0].headline ?? "").not.toContain(testRunId);
    } finally {
      await api.dispose();
    }
  });

  test.skip("ramesh edits headline from the dashboard (browser)", async ({ page }) => {
    // Blocked — DashboardPage / ProfileCard expose no edit affordance
    // (no edit button, no form, no PATCH/PUT call from the UI). Tracking:
    // docs/specs/26-profile-edit-ui.md. When the UI ships, the flow is:
    //   1. primeDashboardSession(page, "ramesh@reviewapp.demo")
    //   2. click data-testid="edit-profile-button"
    //   3. fill new headline → save → reload → assert visible
    //   4. restore via API or UI
    await primeDashboardSession(page, "ramesh@reviewapp.demo");
  });
});
