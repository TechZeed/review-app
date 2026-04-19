import { test, expect, request } from "@playwright/test";
import { loginAs } from "../lib/auth.js";

// Mobile API contract smoke — covers the endpoints the Expo app actually
// hits, in the exact shape it sends. No emulator, no browser — pure HTTP,
// fast (<2s). Catches regressions in the API→mobile contract (spec 19)
// before a CI build reaches testers.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

test.describe("mobile api contract", () => {
  test("GET /profiles/me returns mobile-required fields", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    const { accessToken, user } = await loginAs(api, "ramesh@reviewapp.demo");
    const res = await api.get("/api/v1/profiles/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const profile = await res.json();

    // Spec 19 mobile gaps — all must be present:
    expect(profile.name).toBeTruthy();
    expect(profile.slug).toBeTruthy();
    expect(profile.profileUrl).toMatch(/^https:\/\/.+\/r\/.+/);
    expect(profile.reviewCount).toBeGreaterThanOrEqual(0);
    expect(profile.qualityBreakdown).toBeDefined();
    expect(typeof profile.qualityBreakdown.expertise).toBe("number");

    await api.dispose();
  });

  test("GET /reviews/me returns paginated list", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    const { accessToken } = await loginAs(api, "ramesh@reviewapp.demo");
    const res = await api.get("/api/v1/reviews/me", {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.reviews)).toBeTruthy();
    expect(body.pagination).toMatchObject({ page: 1, limit: expect.any(Number), total: expect.any(Number) });
    if (body.reviews.length > 0) {
      const r = body.reviews[0];
      expect(r.id).toBeTruthy();
      expect(r.profileId).toBeTruthy();
      expect(Array.isArray(r.qualities)).toBeTruthy();
      expect(typeof r.thumbsUp).toBe("boolean");
    }
    await api.dispose();
  });

  test("POST /reviews/scan/:slug accepts deviceFingerprint and returns token", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    const res = await api.post("/api/v1/reviews/scan/priya-sharma", {
      data: { deviceFingerprint: `regression-${Date.now()}-${Math.random().toString(36).slice(2)}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.reviewToken).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.expiresAt).toBeTruthy();
    expect(body.profile?.id).toBeTruthy();
    expect(body.profile?.name).toBeTruthy();
    await api.dispose();
  });
});
