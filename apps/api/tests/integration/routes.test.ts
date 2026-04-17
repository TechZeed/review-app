/**
 * Integration test — Route sanity check.
 *
 * Regression for today's `/api/v1/otp/send` vs `/api/v1/verification/otp/send`
 * mismatch: every URL the frontend hits with a well-formed body must map to a
 * handler. We assert non-404 (and non-5xx) — content correctness is
 * verified by the dedicated suites.
 *
 * If you add a new public frontend call, add it here too.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { bootstrapTestStack } from "./setup.js";
import type { SeededTestData } from "./seed.js";

let app: Express;
let seeded: SeededTestData;
let teardown: (() => Promise<void>) | undefined;

beforeAll(async () => {
  const stack = await bootstrapTestStack();
  app = stack.app;
  seeded = stack.seeded as SeededTestData;
  teardown = stack.teardown;
}, 120_000);

afterAll(async () => {
  if (teardown) {
    await teardown();
  }
});

function pickSlug(): string {
  return seeded.profiles.primary.slug;
}

interface RouteCheck {
  name: string;
  method: "get" | "post" | "patch" | "delete";
  path: () => string;
  body?: () => Record<string, unknown>;
}

function buildRoutes(): RouteCheck[] {
  const fp = "z".repeat(20);
  const fakeToken = randomUUID();
  return [
    {
      name: "POST /api/v1/auth/login",
      method: "post",
      path: () => "/api/v1/auth/login",
      body: () => ({
        email: "admin@test.local",
        password: "Test_Admin_Pass_007",
      }),
    },
    {
      name: "POST /api/v1/reviews/scan/:slug",
      method: "post",
      path: () => `/api/v1/reviews/scan/${pickSlug()}`,
      body: () => ({ deviceFingerprint: fp }),
    },
    {
      name: "POST /api/v1/verification/otp/send",
      method: "post",
      path: () => "/api/v1/verification/otp/send",
      body: () => ({
        reviewToken: fakeToken,
        phone: "+6590009999",
        channel: "sms",
      }),
    },
    {
      name: "POST /api/v1/verification/otp/verify",
      method: "post",
      path: () => "/api/v1/verification/otp/verify",
      body: () => ({
        reviewToken: fakeToken,
        phone: "+6590009999",
        otp: "000007",
      }),
    },
    {
      name: "POST /api/v1/reviews/submit",
      method: "post",
      path: () => "/api/v1/reviews/submit",
      body: () => ({
        reviewToken: fakeToken,
        qualities: ["expertise"],
        qualityDisplayOrder: ["expertise", "care", "delivery", "initiative", "trust"],
        thumbsUp: true,
      }),
    },
    {
      name: "GET /health",
      method: "get",
      path: () => "/health",
    },
  ];
}

describe("Route sanity — every public frontend route is mounted", () => {
  for (const route of buildRoutes()) {
    it(`${route.name} hits a real handler (not a missing-route 404)`, async () => {
      const req = request(app)[route.method](route.path());
      const res = route.body ? await req.send(route.body()) : await req;

      // A 404 from an actual handler (e.g. PROFILE_NOT_FOUND, TOKEN_NOT_FOUND)
      // returns JSON via the global error handler with a `code` field. A 404
      // because Express never matched the route returns text/html "Cannot
      // POST /...". That second case is the regression we are guarding
      // against (the /api/v1/otp/send vs /api/v1/verification/otp/send bug).
      const isJson =
        typeof res.body === "object" && res.body !== null && !Buffer.isBuffer(res.body) && Object.keys(res.body).length > 0;

      if (res.status === 404) {
        expect(
          isJson,
          `route ${route.name} returned a non-JSON 404 — likely an unmounted route`,
        ).toBe(true);
      }

      expect(
        res.status,
        `route ${route.name} returned 5xx (handler crashed)`,
      ).toBeLessThan(500);
    });
  }
});
