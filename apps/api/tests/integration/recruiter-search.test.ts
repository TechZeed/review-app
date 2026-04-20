import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { bootstrapTestStack } from "./setup.js";

let app: Express;

beforeAll(async () => {
  const stack = await bootstrapTestStack();
  app = stack.app;
}, 120_000);

describe("Recruiter search — POST /api/v1/recruiter/search", () => {
  it("returns 200 for recruiter search (recruiter_blocks table available)", async () => {
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "recruiter@test.local",
        password: "Test_Recruiter_Pass_007",
      });

    expect(login.status).toBe(200);
    const token: string = login.body?.accessToken ?? login.body?.data?.accessToken;
    expect(token).toBeTruthy();

    const search = await request(app)
      .post("/api/v1/recruiter/search")
      .set("Authorization", `Bearer ${token}`)
      .send({ limit: 5 });

    expect(search.status).toBe(200);
    expect(Array.isArray(search.body.results)).toBe(true);
    expect(typeof search.body.hasMore).toBe("boolean");
    expect(search.body.nextCursor === null || typeof search.body.nextCursor === "string").toBe(true);
  });
});
