import type { APIRequestContext } from "@playwright/test";

export type LoginResult = { accessToken: string; user: { id: string; email: string; role: string } };

/** Log in with seeded email+password (spec 16; enabled in dev via VITE_FEATURE_EMAIL_LOGIN). */
export async function loginAs(api: APIRequestContext, email: string): Promise<LoginResult> {
  const password = process.env.DEFAULT_SEED_PASSWORD;
  if (!password) throw new Error("DEFAULT_SEED_PASSWORD not set");
  const res = await api.post("/api/v1/auth/login", { data: { email, password } });
  if (!res.ok()) throw new Error(`login failed for ${email}: ${res.status()} ${await res.text()}`);
  return res.json();
}
