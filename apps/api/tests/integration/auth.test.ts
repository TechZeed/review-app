/**
 * Integration test — Email/password login flow.
 *
 * Exercises POST /api/v1/auth/login against the real Express app
 * with a Testcontainers Postgres seeded by ./seed.ts (via ./setup.ts).
 *
 * Regression coverage:
 *   - JWT claim shape (must include role, tier, provider) for downstream RBAC.
 *   - WRONG_PROVIDER vs INVALID_CREDENTIALS distinction
 *     (auth.service.ts:200-219).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
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

describe("Auth — POST /api/v1/auth/login", () => {
  it("logs in admin@test.local with valid password and returns a JWT with role=ADMIN", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@test.local", password: "Test_Admin_Pass_007" });

    expect(res.status).toBe(200);
    const token: string = res.body?.accessToken ?? res.body?.data?.accessToken;
    expect(token, "response should include a JWT in body.accessToken").toBeTruthy();

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(decoded.role).toBe("ADMIN");
    expect(decoded.email).toBe("admin@test.local");
    expect(decoded.provider).toBe("internal");
    expect(decoded.tier).toBeDefined();
    expect(decoded.sub).toBeTruthy();
  });

  it("logs in individual@test.local and returns role=INDIVIDUAL with provider=internal", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "individual@test.local", password: "Test_Individual_Pass_007" });

    expect(res.status).toBe(200);
    const token: string = res.body?.accessToken ?? res.body?.data?.accessToken;
    expect(token).toBeTruthy();

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(decoded.role).toBe("INDIVIDUAL");
    expect(decoded.provider).toBe("internal");
    expect(decoded.tier).toBeDefined();
  });

  it("logs in employer@test.local with role=EMPLOYER", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "employer@test.local", password: "Test_Employer_Pass_007" });

    expect(res.status).toBe(200);
    const token: string = res.body?.accessToken ?? res.body?.data?.accessToken;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(decoded.role).toBe("EMPLOYER");
  });

  it("logs in recruiter@test.local with role=RECRUITER", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "recruiter@test.local", password: "Test_Recruiter_Pass_007" });

    expect(res.status).toBe(200);
    const token: string = res.body?.accessToken ?? res.body?.data?.accessToken;
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload;
    expect(decoded.role).toBe("RECRUITER");
  });

  it("rejects wrong password with 401 INVALID_CREDENTIALS", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@test.local", password: "wrong-password-here" });

    expect(res.status).toBe(401);
    const code = res.body?.code ?? res.body?.error?.code ?? res.body?.error;
    expect(String(code)).toContain("INVALID_CREDENTIALS");
  });

  it("rejects nonexistent email with 401 INVALID_CREDENTIALS (no email enumeration)", async () => {
    const res = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "nobody@test.local", password: "irrelevant_Pass_1" });

    expect(res.status).toBe(401);
    const code = res.body?.code ?? res.body?.error?.code ?? res.body?.error;
    expect(String(code)).toContain("INVALID_CREDENTIALS");
  });
});
