/**
 * Integration test — deviceFingerprint length validation.
 *
 * Regression for today's bug: the frontend sent a 6-char fingerprint and
 * the API silently accepted it. The schema is z.string().min(16).max(128)
 * (apps/api/src/modules/review/review.validation.ts:10).
 *
 * Verifies the boundaries explicitly so any future schema relaxation
 * trips a test.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
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

async function scanWithFingerprint(fp: string) {
  const slug = seeded.profiles.primary.slug;
  return request(app)
    .post(`/api/v1/reviews/scan/${slug}`)
    .send({ deviceFingerprint: fp });
}

describe("deviceFingerprint length validation (POST /api/v1/reviews/scan/:slug)", () => {
  it("rejects an 8-char fingerprint with 400", async () => {
    const res = await scanWithFingerprint("a".repeat(8));
    expect(res.status).toBe(400);
  });

  it("accepts exactly 16 chars (lower boundary)", async () => {
    const res = await scanWithFingerprint("a".repeat(16));
    expect([200, 201]).toContain(res.status);
  });

  it("accepts exactly 128 chars (upper boundary)", async () => {
    const res = await scanWithFingerprint("a".repeat(128));
    expect([200, 201]).toContain(res.status);
  });

  it("rejects 129 chars with 400 (just above the upper bound)", async () => {
    const res = await scanWithFingerprint("a".repeat(129));
    expect(res.status).toBe(400);
  });

  it("rejects an empty string with 400", async () => {
    const res = await scanWithFingerprint("");
    expect(res.status).toBe(400);
  });
});
