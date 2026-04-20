import type { APIRequestContext } from "@playwright/test";
import type { components } from "../api-types.js";

export type LoginResult = components["schemas"]["ExchangeTokenResponse"];

/** Thrown when login hits the auth rate limiter (429). Specs can catch and test.skip(). */
export class LoginRateLimitedError extends Error {
  constructor(email: string) {
    super(`login rate-limited (429) for ${email} — authRateLimit is 5/15min per IP`);
    this.name = "LoginRateLimitedError";
  }
}

// Process-wide login cache. Hitting /auth/login once per test in a full
// suite trips the backend rate limiter (authRateLimit, see
// apps/api/src/modules/auth/auth.routes.ts), so we memoise per-email.
// Tokens are short-lived JWTs but well within a single suite run.
const loginCache = new Map<string, Promise<LoginResult>>();

/** Log in with seeded email+password (spec 16; enabled in dev via VITE_FEATURE_EMAIL_LOGIN). */
export async function loginAs(api: APIRequestContext, email: string): Promise<LoginResult> {
  const cached = loginCache.get(email);
  if (cached) return cached;
  const password = process.env.DEFAULT_SEED_PASSWORD;
  if (!password) throw new Error("DEFAULT_SEED_PASSWORD not set");
  const p = (async () => {
    const res = await api.post("/api/v1/auth/login", { data: { email, password } });
    if (!res.ok()) {
      // Don't cache failures — the next caller gets a fresh attempt.
      loginCache.delete(email);
      if (res.status() === 429) throw new LoginRateLimitedError(email);
      throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`);
    }
    return res.json() as Promise<LoginResult>;
  })();
  loginCache.set(email, p);
  return p;
}
