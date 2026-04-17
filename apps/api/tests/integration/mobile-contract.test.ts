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

    it("accepts client-supplied deviceFingerprint (16–128 char)", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${slug()}`)
        .send({ deviceFingerprint: "a".repeat(32) });
      expect(res.status).toBe(201);
      expect(res.body.reviewToken).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("derives deviceFingerprint from UA + IP when the client omits it (spec 19 B1)", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${slug()}`)
        .set("User-Agent", "b1-fallback-test")
        .send({});
      expect(res.status).toBe(201);
      expect(res.body.reviewToken).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("rejects fingerprint shorter than the 16-char minimum", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${slug()}`)
        .send({ deviceFingerprint: "abc" });
      expect(res.status).toBe(400);
    });
  });

  // ─── B2: /profiles/:slug returns headline as name ────────────────────
  // Current: `name` contains the role_title/headline, not the person's
  // actual full name. No separate `headline` field exposed.
  describe("B2: GET /api/v1/profiles/:slug", () => {
    it("returns the user's display name in `name` and the role title in `headline` (spec 19 B2)", async () => {
      const res = await request(app).get(
        `/api/v1/profiles/${seeded.profiles.primary.slug}`,
      );
      expect(res.status).toBe(200);
      // `name` is a person name — matches the seeded user's display name.
      expect(res.body.name).toBe("Test Individual");
      // `headline` is the separate role title field.
      expect(typeof res.body.headline).toBe("string");
    });
  });

  // ─── B3: /auth/exchange-token naming mismatch ────────────────────────
  // Server expects `firebaseToken`; spec 21 + mobile clients use
  // `firebaseIdToken`. Mobile workaround renames on the wire.
  describe("B3: POST /api/v1/auth/exchange-token", () => {
    // Spec 19 B3: server now accepts either field name. Downstream
    // firebase-admin rejects the fake token either way, so we assert
    // that validation PASSED (no VALIDATION_ERROR about missing field).
    const isNotValidationMissingField = (body: any) => {
      const s = JSON.stringify(body);
      return !/"firebase(Id)?Token".*(?:Required|required)/i.test(s);
    };

    it("accepts firebaseIdToken field name (spec 19 B3)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/exchange-token")
        .send({ firebaseIdToken: "not-a-real-firebase-id-token" });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(isNotValidationMissingField(res.body)).toBe(true);
    });

    it("accepts firebaseToken field name (legacy alias)", async () => {
      const res = await request(app)
        .post("/api/v1/auth/exchange-token")
        .send({ firebaseToken: "not-a-real-firebase-id-token" });
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(isNotValidationMissingField(res.body)).toBe(true);
    });

    it("rejects body with neither firebaseIdToken nor firebaseToken", async () => {
      const res = await request(app).post("/api/v1/auth/exchange-token").send({});
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(/firebase/i);
    });
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

    it("includes qualityBreakdown in /profiles/me so Home needs one round-trip (spec 19 B4)", async () => {
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
      expect(me.status).toBe(200);
      expect(me.body.qualityBreakdown).toBeDefined();
      expect(me.body.qualityBreakdown.expertise).toBeDefined();
      expect(me.body.qualityBreakdown.care).toBeDefined();
      expect(me.body.qualityBreakdown.trust).toBeDefined();
      // B2 applied to /me as well: name = display name, headline = role title.
      expect(me.body.name).toBe("Test Individual");
      expect(typeof me.body.headline).toBe("string");
    });
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

    it("customer-side review history at GET /api/v1/reviews/my-submissions (spec 19)", async () => {
      // Empty-state: a fresh device fingerprint has no reviews yet.
      const res = await request(app)
        .get("/api/v1/reviews/my-submissions")
        .query({ deviceFingerprint: "c".repeat(40) });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.reviews)).toBe(true);
      expect(res.body.reviews.length).toBe(0);
      expect(res.body.pagination).toMatchObject({ page: 1, limit: 20, total: 0 });
    });
  });
});
