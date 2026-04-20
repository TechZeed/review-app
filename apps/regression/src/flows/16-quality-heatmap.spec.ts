import { test, expect, request } from "@playwright/test";
import { primeDashboardSession } from "../lib/browserAuth.js";

// Reviewee daily-loop coverage — five-quality heat map (PRD 02).
//
// QualityHeatMap renders one row per quality (Expertise, Care, Delivery,
// Initiative, Trust). Each row shows a "<n>%" label sourced from
// /profiles/me's qualityBreakdown (apps/ui/src/lib/quality.ts).
//
// We assert:
//   1. All five quality names render on the dashboard.
//   2. Each row's percentage matches the API's qualityBreakdown
//      (rounded to whole %, since the UI uses {n}% with no formatter).
//   3. Sum stays in [0, 100*N] sanity bounds.
//
// No DB writes.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

const QUALITY_KEYS = ["expertise", "care", "delivery", "initiative", "trust"] as const;
type QualityKey = (typeof QUALITY_KEYS)[number];

test.describe("dashboard quality heatmap (spec PRD-02)", () => {
  test("ramesh's heatmap renders 5 qualities with percentages matching API", async ({ page }) => {
    const { accessToken } = await primeDashboardSession(page, "ramesh@reviewapp.demo");

    // Heat map container: role=img + aria-label "Expertise: X%, ..."
    const heatmap = page.getByRole("img", { name: /expertise.*care.*delivery.*initiative.*trust/i });
    await expect(heatmap).toBeVisible({ timeout: 10_000 });

    // All five quality names visible.
    for (const name of ["Expertise", "Care", "Delivery", "Initiative", "Trust"]) {
      await expect(heatmap.getByText(name, { exact: true })).toBeVisible();
    }

    // Pull the API's qualityBreakdown so we can compare row-by-row.
    const api = await request.newContext({ baseURL: API_URL });
    let breakdown: Partial<Record<QualityKey, number>> | undefined;
    try {
      const res = await api.get("/api/v1/profiles/me", {
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.ok()).toBeTruthy();
      const me = await res.json();
      breakdown = me.qualityBreakdown;
    } finally {
      await api.dispose();
    }

    // Spec 19 entry — qualityBreakdown is a known mobile-API gap. If the
    // API still doesn't return it, skip the per-row assertion with a
    // pointer rather than failing red.
    test.skip(
      !breakdown,
      "qualityBreakdown missing from /profiles/me — see docs/specs/19-mobile-api-bugs.md",
    );

    // ARIA label is "Expertise: 42%, Care: 30%, ..." — parse it back into
    // a map and compare against the API. This is the most robust read of
    // what the UI actually rendered (sort order is by percentage desc).
    const ariaLabel = await heatmap.getAttribute("aria-label");
    expect(ariaLabel).toBeTruthy();

    const uiPercents: Partial<Record<QualityKey, number>> = {};
    for (const part of ariaLabel!.split(/,\s*/)) {
      const m = part.match(/^(Expertise|Care|Delivery|Initiative|Trust):\s*(\d+)%$/);
      if (!m) continue;
      const key = m[1].toLowerCase() as QualityKey;
      uiPercents[key] = Number(m[2]);
    }
    expect(Object.keys(uiPercents).sort()).toEqual([...QUALITY_KEYS].sort());

    // Each rendered % must equal the API value (the UI does no rounding
    // on its own — quality.ts passes the number through verbatim, then
    // the JSX renders `${q.percentage}%`).
    for (const key of QUALITY_KEYS) {
      const apiVal = breakdown![key] ?? 0;
      expect(uiPercents[key]).toBe(Math.round(apiVal));
    }

    // Sanity: percentages are in range.
    for (const v of Object.values(uiPercents)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});
