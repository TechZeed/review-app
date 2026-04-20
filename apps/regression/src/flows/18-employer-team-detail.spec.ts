import { test, expect, request, type APIRequestContext } from "@playwright/test";
import { loginAs } from "../lib/auth.js";
import { primeDashboardSession } from "../lib/browserAuth.js";
import {
  adminGrantCapability,
  adminListUsers,
  adminRevokeCapability,
} from "../lib/adminApi.js";

// Spec 18 (regression) — Employer Team tab + retention alerts detail.
//
// 08-employer.spec.ts covers tab visibility/routing. This file drills into
// the Team Reviews tab content (per-row data shape, spec 13) and the
// References inbox retention cards (renders without error, accepts empty
// state). James is the seeded EMPLOYER; capability grant follows the
// pattern from 08-employer.spec.ts (spec 28 — james doesn't get the cap
// from seed).

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

let api: APIRequestContext;
let adminToken: string;
let jamesId: string | null = null;

test.beforeAll(async () => {
  api = await request.newContext({ baseURL: API_URL });
  const { accessToken } = await loginAs(api, "admin@reviewapp.demo");
  adminToken = accessToken;
  const { users } = await adminListUsers(api, adminToken);
  jamesId = users.find((u) => u.email === "james@reviewapp.demo")?.id ?? null;
  if (jamesId) {
    await adminGrantCapability(api, adminToken, jamesId, "employer", "regression-suite");
  }
});

test.afterAll(async () => {
  if (jamesId) {
    await adminRevokeCapability(api, adminToken, jamesId, "employer").catch(() => {});
  }
  await api.dispose();
});

// GAP — james@reviewapp.demo has no employer_dashboards row in dev seed,
// so `requireOrgId` throws ORG_NOT_FOUND and both /employer/team and
// /employer/team/retention return errors. The UI renders the
// "Failed to load team." / "Failed to load retention signals." banner,
// not the expected empty-state copy. Fixing needs a seed change — see
// docs/specs/32-employer-team-seed-gap.md. Re-enable both tests once
// james is linked to an org with at least one consented member.
test.describe.skip("employer team detail (ui)", () => {
  test("Team tab renders member rows with name + reviews + composite + quality", async ({ page }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "james@reviewapp.demo").catch(() => {
      // Defensive — james is EMPLOYER so dashboard-root should appear.
    });
    await page.goto("/employer");
    await expect(page.getByTestId("employer-root")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("employer-tab-team").click();
    await expect(page.getByTestId("employer-team")).toBeVisible();
    await expect(page.getByRole("heading", { name: /team members/i })).toBeVisible();

    // Wait for either the populated table or the empty-state message —
    // whichever resolves first. The /employer/team endpoint may return
    // an empty list if james's org has no consented members yet (see
    // GAP — docs/specs/32-employer-team-seed-gap.md).
    const rows = page.getByTestId("employer-team-review-row");
    const empty = page.getByText(/no consented team members yet/i);
    await Promise.race([
      rows.first().waitFor({ state: "visible", timeout: 10_000 }),
      empty.waitFor({ state: "visible", timeout: 10_000 }),
    ]).catch(() => {
      // Neither appeared — let the count assertion below produce the
      // useful failure message.
    });

    const rowCount = await rows.count();
    if (rowCount === 0) {
      // Data gap — skip detail assertions but keep the render check.
      test.info().annotations.push({
        type: "gap",
        description:
          "employer team list returned 0 members — see docs/specs/32-employer-team-seed-gap.md",
      });
      await expect(empty).toBeVisible();
      return;
    }

    expect(rowCount).toBeGreaterThanOrEqual(1);

    // First row carries name + 4 numeric/string cells per the table
    // schema in EmployerPage.tsx (Name, Role, Reviews, Composite, Top quality).
    const firstRow = rows.first();
    const cells = firstRow.locator("td");
    await expect(cells).toHaveCount(5);

    // Name cell is non-empty.
    const name = (await cells.nth(0).textContent())?.trim() ?? "";
    expect(name.length).toBeGreaterThan(0);

    // Reviews cell is a non-negative integer (rendered via `?? 0`).
    const reviewsText = (await cells.nth(2).textContent())?.trim() ?? "";
    expect(reviewsText).toMatch(/^\d+$/);

    // Composite is either a 2-decimal number or em-dash placeholder.
    const compositeText = (await cells.nth(3).textContent())?.trim() ?? "";
    expect(compositeText).toMatch(/^(\d+\.\d{2}|—)$/);
  });

  test("References inbox renders retention signals (or empty state) without error", async ({
    page,
  }) => {
    await page.goto("/login");
    await primeDashboardSession(page, "james@reviewapp.demo").catch(() => {});
    await page.goto("/employer");
    await expect(page.getByTestId("employer-root")).toBeVisible({ timeout: 15_000 });

    // References tab is the default but click defensively in case
    // another test run left a different tab selected via state.
    await page.getByTestId("employer-tab-references").click();
    await expect(page.getByTestId("employer-references")).toBeVisible();

    // Wait for the retention query to resolve — either rows render, the
    // empty-state copy appears, or an error banner shows. The first two
    // are valid; the third fails the test.
    const alertRows = page.getByTestId("employer-reference-row");
    const empty = page.getByText(/no retention alerts/i);
    const errorBanner = page.getByText(/failed to load retention signals/i);

    await Promise.race([
      alertRows.first().waitFor({ state: "visible", timeout: 10_000 }),
      empty.waitFor({ state: "visible", timeout: 10_000 }),
      errorBanner.waitFor({ state: "visible", timeout: 10_000 }),
    ]).catch(() => {
      // Render took longer than expected — fall through to assertions.
    });

    await expect(errorBanner).toBeHidden();

    const count = await alertRows.count();
    if (count === 0) {
      await expect(empty).toBeVisible();
    } else {
      // Each card carries a name + a stub approve/decline pair (disabled
      // until the API ships — see EmployerPage.tsx "API GAPS" comment).
      await expect(alertRows.first().getByTestId("employer-approve-ref-btn")).toBeVisible();
      await expect(alertRows.first().getByTestId("employer-decline-ref-btn")).toBeVisible();
    }
  });
});
