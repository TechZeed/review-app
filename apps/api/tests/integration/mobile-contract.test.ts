/**
 * Regression coverage for the mobile/web API contract bugs tracked in
 * docs/specs/19-mobile-api-bugs.md.
 *
 * Strategy:
 *   - `it(...)` assertions document *current* server behaviour (so this
 *     suite stays green while the bugs are open).
 *   - `it.todo(...)` placeholders describe the *target* behaviour per
 *     spec 19. When an API-sprint PR lands the fix, flip .todo → it and
 *     replace the current-state test above it.
 *
 * This file is also the integration-level probe for the "unverified
 * endpoints" table at the bottom of spec 19 — run this, copy the probe
 * outputs into the spec to confirm/discard entries.
 */

import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bootstrapTestStack } from "./setup.js";
import type { SeededTestData } from "./seed.js";

let app: Express;
let seeded: SeededTestData;

beforeAll(async () => {
  const stack = await bootstrapTestStack();
  app = stack.app;
  seeded = stack.seeded as SeededTestData;
}, 120_000);

describe("Mobile/web API contract — spec 19 regression watch", () => {
  // ─── B1: /reviews/scan/:slug requires deviceFingerprint ──────────────
  // Current server contract: client MUST send 16..128 char fingerprint.
  // Web frontend now sends SHA-256 hex (64 chars). Spec 19 option (a)
  // (server-side fallback from UA+IP) is not implemented.
  describe("B1: POST /api/v1/reviews/scan/:slug", () => {
    const slug = () => seeded.profiles.primary.slug;

    it("rejects request with no deviceFingerprint field", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${slug()}`)
        .send({ qualityIds: [], thumbsUp: true });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/deviceFingerprint/);
    });

    it("rejects empty-string deviceFingerprint", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${slug()}`)
        .send({ deviceFingerprint: "" });
      expect(res.status).toBe(400);
    });

    it.todo(
      "optionally derives deviceFingerprint from UA + IP when client omits it (spec 19 B1 option a)",
    );
  });

  // ─── B2: /profiles/:slug returns headline as name ────────────────────
  // Current: `name` contains the role_title/headline, not the person's
  // actual full name. No separate `headline` field exposed.
  describe("B2: GET /api/v1/profiles/:slug", () => {
    it("documents current buggy shape: body has a string `name` and no separate `headline`", async () => {
      const res = await request(app).get(
        `/api/v1/profiles/${seeded.profiles.primary.slug}`,
      );
      expect(res.status).toBe(200);
      expect(typeof res.body.name).toBe("string");
      // When B2 is fixed, `headline` should be present. Today it isn't.
      expect(res.body.headline).toBeUndefined();
    });

    it.todo(
      "returns the user's display name in `name` and the role title in `headline` (spec 19 B2)",
    );
  });

  // ─── B3: /auth/exchange-token naming mismatch ────────────────────────
  // Server expects `firebaseToken`; spec 21 + mobile clients use
  // `firebaseIdToken`. Mobile workaround renames on the wire.
  describe("B3: POST /api/v1/auth/exchange-token", () => {
    it("rejects firebaseIdToken field — validator still requires firebaseToken", async () => {
      const res = await request(app)
        .post("/api/v1/auth/exchange-token")
        .send({ firebaseIdToken: "anything" });
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/firebaseToken/);
    });

    it("accepts firebaseToken field name (passes schema validation)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/exchange-token")
        .send({ firebaseToken: "not-a-real-firebase-id-token" });
      // Body passes zod; downstream firebase-admin.verifyIdToken rejects.
      // In the test env FIREBASE_PROJECT_ID is a stub so verification may
      // throw internally → 500. Any non-2xx proves the field name was
      // accepted by the validator (if it weren't, we'd get VALIDATION_ERROR 400
      // with `firebaseToken` in the error message).
      expect(res.status).toBeGreaterThanOrEqual(400);
      if (res.status === 400) {
        expect(JSON.stringify(res.body)).not.toMatch(/"firebaseToken".*Required/);
      }
    });

    it.todo(
      "renames API field to firebaseIdToken (or accepts both) so spec 21 + mobile client match (spec 19 B3)",
    );
  });

  // ─── B4: /profiles/me missing qualityBreakdown ───────────────────────
  // Baseline: public route /profiles/:slug exposes qualityBreakdown.
  // Authenticated route /profiles/me does not.
  describe("B4: GET /api/v1/profiles/me", () => {
    it("baseline: public /profiles/:slug includes qualityBreakdown", async () => {
      const res = await request(app).get(
        `/api/v1/profiles/${seeded.profiles.primary.slug}`,
      );
      expect(res.status).toBe(200);
      expect(res.body.qualityBreakdown).toBeDefined();
    });

    it("current shape: /profiles/me does NOT include qualityBreakdown", async () => {
      // Login as the seeded INDIVIDUAL user (email/password, internal provider).
      const login = await request(app)
        .post("/api/v1/auth/login")
        .send({
          email: "individual@test.local",
          password: "Test_Individual_Pass_007",
        });
      expect(login.status).toBe(200);
      const token: string =
        login.body?.accessToken ?? login.body?.data?.accessToken;
      expect(token).toBeTruthy();

      const me = await request(app)
        .get("/api/v1/profiles/me")
        .set("Authorization", `Bearer ${token}`);
      // Route may not be mounted (404) or return without the field — both
      // are current-state. When B4 is fixed, replace with a positive assertion.
      if (me.status === 200) {
        expect(me.body.qualityBreakdown).toBeUndefined();
      } else {
        expect([401, 403, 404]).toContain(me.status);
      }
    });

    it.todo(
      "includes qualityBreakdown in /profiles/me so Home screen needs only one round-trip (spec 19 B4)",
    );
  });

  // ─── Unverified endpoints from spec 19 ───────────────────────────────
  // Probes that log the live status codes so spec 19's bottom table can
  // be updated from ❓ to ✅/⚠️.
  describe("Spec 19 unverified endpoints — probe & log", () => {
    it("probe: GET /api/v1/profiles/search?q=nurse", async () => {
      const res = await request(app).get("/api/v1/profiles/search?q=nurse");
      console.log(
        `[spec 19 probe] GET /profiles/search?q=... → ${res.status} ${
          res.status === 404 ? "(route not mounted)" : ""
        }`,
      );
      // Flexible — we're not asserting behavior, just recording it.
      expect(typeof res.status).toBe("number");
    });

    it("probe: POST /api/v1/references/grant", async () => {
      const res = await request(app)
        .post("/api/v1/references/grant")
        .send({});
      console.log(
        `[spec 19 probe] POST /references/grant → ${res.status} ${
          res.status === 404 ? "(route not mounted)" : ""
        }`,
      );
      expect(typeof res.status).toBe("number");
    });

    it.todo(
      "customer-side review history endpoint — spec 19 table row 3 (no path assumed yet)",
    );
  });
});
