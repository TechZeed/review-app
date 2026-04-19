import { test, expect, request } from "@playwright/test";
import { loginAs } from "../lib/auth.js";

// Minimal wiring smoke — no browser, no DB. Confirms:
// 1. Regression workspace loads config.
// 2. API URL reachable.
// 3. Seeded email+password login works (post-seed-wiring, d26).
// Must pass before any full flow spec is written.

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";

test.describe("smoke", () => {
  test("API /health responds", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    const res = await api.get("/health");
    expect(res.ok()).toBeTruthy();
    await api.dispose();
  });

  test("seeded user logs in via email+password", async () => {
    const api = await request.newContext({ baseURL: API_URL });
    const result = await loginAs(api, "ramesh@reviewapp.demo");
    expect(result.accessToken).toBeTruthy();
    expect(result.user.email).toBe("ramesh@reviewapp.demo");
    expect(result.user.role).toBe("INDIVIDUAL");
    await api.dispose();
  });
});
