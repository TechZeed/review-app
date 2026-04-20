import { test, expect, request, type APIRequestContext, type Page } from "@playwright/test";
import type { Client } from "pg";
import { openDb, closeDb, type DbCtx } from "../lib/dbProxy.js";

const API_URL = process.env.REGRESSION_API_URL ?? "https://review-api.teczeed.com";
const TARGET_EMAIL = "ramesh@reviewapp.demo";

type LoginUser = {
  id: string;
  email: string;
  role: string;
  name?: string;
};

let api: APIRequestContext;
let dbCtx: DbCtx;
let targetUserId: string;

async function withDbProxy<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  return fn(dbCtx.client);
}

async function seedBillingState(opts: {
  subId: string;
  withCapability: boolean;
  subscriptionTier?: "recruiter";
  noSubscription?: boolean;
}) {
  const tier = opts.subscriptionTier ?? "recruiter";
  const now = new Date();
  const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  await withDbProxy((client) =>
    client.query(
      `DELETE FROM user_capabilities
       WHERE user_id = $1
         AND source = 'subscription'
         AND capability IN ('pro','employer','recruiter')`,
      [targetUserId],
    ),
  );

  await withDbProxy((client) =>
    client.query(
      `DELETE FROM subscriptions
       WHERE user_id = $1
         AND id = $2`,
      [targetUserId, opts.subId],
    ),
  );

  if (!opts.noSubscription) {
    await withDbProxy((client) =>
      client.query(
        `INSERT INTO subscriptions
          (id, user_id, tier, stripe_customer_id, stripe_subscription_id, status, current_period_start, current_period_end, created_at, updated_at)
         VALUES
          ($1, $2, $3, NULL, NULL, 'active', $4, $5, $4, $4)
         ON CONFLICT (id) DO UPDATE
         SET tier = EXCLUDED.tier,
             status = 'active',
             current_period_start = EXCLUDED.current_period_start,
             current_period_end = EXCLUDED.current_period_end,
             updated_at = EXCLUDED.updated_at`,
        [opts.subId, targetUserId, tier, now, periodEnd],
      ),
    );
  }

  if (opts.withCapability && tier === "recruiter") {
    await withDbProxy((client) =>
      client.query(
        `INSERT INTO user_capabilities
          (id, user_id, capability, source, subscription_id, granted_at, expires_at, metadata, created_at, updated_at)
         VALUES
          (gen_random_uuid(), $1, 'recruiter', 'subscription', $2, NOW(), $3, NULL, NOW(), NOW())`,
        [targetUserId, opts.subId, periodEnd],
      ),
    );
  }
}

async function loginAndSeedBillingSession(page: Page) {
  const password = process.env.DEFAULT_SEED_PASSWORD;
  expect(password, "DEFAULT_SEED_PASSWORD required").toBeTruthy();

  const loginRes = await api.post("/api/v1/auth/login", {
    data: { email: TARGET_EMAIL, password },
  });
  expect(loginRes.ok()).toBeTruthy();
  const { accessToken, user } = (await loginRes.json()) as {
    accessToken: string;
    user: LoginUser;
  };

  const meRes = await api.get("/api/v1/subscriptions/me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  expect(meRes.ok()).toBeTruthy();
  const me = await meRes.json();
  const capabilities = (me?.capabilities ?? [])
    .map((c: { capability: string }) => c.capability)
    .filter((c: string) => !!c);

  await page.goto("/login");
  await page.evaluate(
    ({ token, userId, email, role, name, caps }) => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          token,
          id: userId,
          email,
          role,
          name,
          profile_slug: "",
          capabilities: caps,
        }),
      );
    },
    {
      token: accessToken,
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name ?? "",
      caps: capabilities,
    },
  );
}

test.describe("billing pathways (spec 48)", () => {
  test.beforeAll(async () => {
    api = await request.newContext({ baseURL: API_URL });
    dbCtx = await openDb();
    const { rows } = await withDbProxy((client) =>
      client.query<{ id: string }>("SELECT id FROM users WHERE email = $1 LIMIT 1", [TARGET_EMAIL]),
    );
    if (!rows.length) throw new Error(`Unable to find seeded user ${TARGET_EMAIL}`);
    targetUserId = rows[0]!.id;
  });

  test.afterAll(async () => {
    await withDbProxy((client) =>
      client.query(
        `DELETE FROM user_capabilities
         WHERE user_id = $1
           AND source = 'subscription'
           AND capability IN ('pro','employer','recruiter')`,
        [targetUserId],
      ),
    ).catch(() => {});
    await withDbProxy((client) =>
      client.query(
        `DELETE FROM subscriptions
         WHERE user_id = $1
           AND id IN ('77777777-7777-4777-8777-777777777701','77777777-7777-4777-8777-777777777702','77777777-7777-4777-8777-777777777703')`,
        [targetUserId],
      ),
    ).catch(() => {});
    await api.dispose();
    await closeDb(dbCtx);
  });

  test("active recruiter capability shows Change plan and Cancel on recruiter pathway", async ({ page }) => {
    await seedBillingState({
      subId: "77777777-7777-4777-8777-777777777701",
      withCapability: true,
      subscriptionTier: "recruiter",
    });
    await loginAndSeedBillingSession(page);
    await page.goto("/billing");
    await expect(page.getByTestId("billing-root")).toBeVisible({ timeout: 15_000 });

    const recruiterCard = page.getByTestId("billing-pathway-recruiter");
    await expect(recruiterCard).toContainText("You're a Recruiter");
    await expect(recruiterCard.getByRole("button", { name: "Change plan" })).toBeVisible();
    await expect(recruiterCard.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(recruiterCard).not.toContainText("Become a Recruiter");
  });

  test("tier-without-capability shows reconciliation banner once then self-heals", async ({ page }) => {
    const subId = "77777777-7777-4777-8777-777777777702";
    await seedBillingState({ subId, withCapability: false, subscriptionTier: "recruiter" });
    await loginAndSeedBillingSession(page);

    await page.goto("/billing");
    await expect(page.getByTestId("billing-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("billing-reconciliation-warning")).toBeVisible();

    const capCount = await withDbProxy(async (client) => {
      const result = await client.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM user_capabilities
         WHERE user_id = $1
           AND capability = 'recruiter'
           AND source = 'subscription'
           AND subscription_id = $2`,
        [targetUserId, subId],
      );
      return Number(result.rows[0]?.count ?? 0);
    });
    expect(capCount).toBeGreaterThan(0);

    await page.reload();
    await expect(page.getByTestId("billing-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("billing-reconciliation-warning")).toHaveCount(0);
  });

  test("free-tier pathway renders Become CTA for all three tracks", async ({ page }) => {
    await seedBillingState({
      subId: "77777777-7777-4777-8777-777777777703",
      withCapability: false,
      noSubscription: true,
    });
    await loginAndSeedBillingSession(page);

    await page.goto("/billing");
    await expect(page.getByTestId("billing-root")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("billing-pathway-individual")).toContainText("Become a Pro Individual");
    await expect(page.getByTestId("billing-pathway-employer")).toContainText("Become a Company");
    await expect(page.getByTestId("billing-pathway-recruiter")).toContainText("Become a Recruiter");
  });
});
