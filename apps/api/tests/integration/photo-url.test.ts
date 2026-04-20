/**
 * Spec 25 — Reviewee photo.
 *
 * Asserts the API exposes `photoUrl` on the public profile, on
 * `/profiles/me`, and on the `/reviews/scan/:slug` response — and that
 * the scan response returns `name = displayName`, `headline = profile.headline`
 * (the spec 19 B2 fix applied to the scan path).
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

describe("Spec 25 — photoUrl on profile + scan", () => {
  const loginAs = async (email: string, password: string): Promise<string> => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password });
    expect(login.status).toBe(200);
    const token: string =
      login.body?.accessToken ?? login.body?.data?.accessToken;
    expect(token).toBeTruthy();
    return token;
  };

  describe("GET /api/v1/profiles/:slug", () => {
    it("returns photoUrl: null when user.avatarUrl is unset (seeded individual)", async () => {
      const res = await request(app).get(
        `/api/v1/profiles/${seeded.profiles.primary.slug}`,
      );
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("photoUrl");
      expect(res.body.photoUrl).toBeNull();
    });
  });

  describe("GET /api/v1/profiles/me", () => {
    it("includes photoUrl in the response", async () => {
      const token = await loginAs(
        "individual@test.local",
        "Test_Individual_Pass_007",
      );

      const me = await request(app)
        .get("/api/v1/profiles/me")
        .set("Authorization", `Bearer ${token}`);
      expect(me.status).toBe(200);
      expect(me.body).toHaveProperty("photoUrl");
      expect(me.body.photoUrl).toBeNull();
    });

    it("does not 403 for authenticated non-INDIVIDUAL roles (spec 49)", async () => {
      const roleLogins = [
        { email: "employer@test.local", password: "Test_Employer_Pass_007", expectedStatus: 200 },
        { email: "recruiter@test.local", password: "Test_Recruiter_Pass_007", expectedStatus: 404 },
        { email: "admin@test.local", password: "Test_Admin_Pass_007", expectedStatus: 404 },
      ] as const;

      for (const roleLogin of roleLogins) {
        const token = await loginAs(roleLogin.email, roleLogin.password);
        const me = await request(app)
          .get("/api/v1/profiles/me")
          .set("Authorization", `Bearer ${token}`);

        expect(me.status, `${roleLogin.email} should not be blocked by role gate`).toBe(roleLogin.expectedStatus);
        expect(me.status, `${roleLogin.email} should not receive RBAC 403`).not.toBe(403);
      }
    });
  });

  describe("POST /api/v1/reviews/scan/:slug", () => {
    it("returns profile.name=displayName, profile.headline=profile.headline, profile.photoUrl=null", async () => {
      const res = await request(app)
        .post(`/api/v1/reviews/scan/${seeded.profiles.primary.slug}`)
        .send({ deviceFingerprint: "s".repeat(32) });
      expect(res.status).toBe(201);
      expect(res.body.profile).toBeDefined();
      // name is the person name (display_name), not the role title.
      expect(res.body.profile.name).toBe("Test Individual");
      // headline is the profile.headline (role title).
      expect(res.body.profile.headline).toBe("Fresh test profile");
      // photoUrl is null because seed users have avatar_url = null.
      expect(res.body.profile).toHaveProperty("photoUrl");
      expect(res.body.profile.photoUrl).toBeNull();
    });
  });
});
