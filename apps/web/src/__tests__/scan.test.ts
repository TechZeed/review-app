import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { scanProfile, type ScanResponse } from "../lib/scan";

const API_URL = process.env.VITE_API_URL ?? "http://localhost:3000";

const server = setupServer();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("scanProfile", () => {
  it("extracts reviewToken and profile from scan response", async () => {
    const payload: ScanResponse = {
      reviewToken: "2b32898f-b556-4f99-a53d-59fc979f0d5c",
      expiresAt: "2026-04-21T09:00:00.000Z",
      profile: {
        id: "a1f53fc8-63ba-4fd9-a05f-c30f872da8e8",
        name: "Ramesh Kumar",
      },
    };

    server.use(
      http.post(`${API_URL}/api/v1/reviews/scan/ramesh-kumar`, () =>
        HttpResponse.json(payload),
      ),
    );

    const response = await scanProfile(
      API_URL,
      "ramesh-kumar",
      "1234567890abcdef1234567890abcdef",
    );

    expect(response.reviewToken).toBe(payload.reviewToken);
    expect(response.profile).toEqual(payload.profile);
  });
});
