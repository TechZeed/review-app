#!/usr/bin/env bun
/**
 * Spec 28 backfill — for every existing active/trialing paid subscription,
 * insert a matching user_capabilities row with source='subscription'.
 *
 * Idempotent: skips if a row already exists for (user_id, capability, source).
 *
 * Usage (against dev — run with the cloud-sql-proxy already up):
 *   task dev:startproxy    # in another terminal
 *   bun run --env-file=.env.dev infra/scripts/backfill-capabilities.ts
 *
 * Reads POSTGRES_* from the loaded env. Same shape as apps/api uses.
 */

import { Client } from "pg";

function die(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

async function main() {
  const host = process.env.POSTGRES_HOST;
  const port = Number(process.env.POSTGRES_PORT ?? 5432);
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB;

  if (!host || !user || !password || !database) {
    die("POSTGRES_HOST/USER/PASSWORD/DB must be set (source .env.dev)");
  }

  const client = new Client({ host, port, user, password, database });
  await client.connect();

  try {
    // Active/trialing paid subs. tier !== 'free' in the DB layer maps to
    // 'pro' | 'employer' | 'recruiter'.
    const { rows } = await client.query<{
      id: string;
      user_id: string;
      tier: string;
      stripe_subscription_id: string | null;
    }>(
      `SELECT id, user_id, tier, stripe_subscription_id
       FROM subscriptions
       WHERE status IN ('active', 'trialing')
         AND tier IS NOT NULL
         AND tier <> 'free'`,
    );

    console.log(`→ Found ${rows.length} active paid subscription rows`);

    let inserted = 0;
    let skipped = 0;

    for (const sub of rows) {
      // Idempotency check.
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM user_capabilities
         WHERE user_id = $1 AND capability = $2 AND source = $3
         LIMIT 1`,
        [sub.user_id, sub.tier, "subscription"],
      );

      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      const metadata = JSON.stringify({
        stripe_subscription_id: sub.stripe_subscription_id,
        backfill: true,
      });

      await client.query(
        `INSERT INTO user_capabilities
           (id, user_id, capability, source, subscription_id, granted_at, expires_at, metadata, created_at, updated_at)
         VALUES
           (gen_random_uuid(), $1, $2, 'subscription', $3, NOW(), NULL, $4::jsonb, NOW(), NOW())`,
        [sub.user_id, sub.tier, sub.id, metadata],
      );
      inserted++;
      console.log(`  +  user=${sub.user_id} cap=${sub.tier} sub=${sub.id}`);
    }

    console.log(`✓ Backfill done. inserted=${inserted} skipped=${skipped}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => die(err?.stack ?? String(err)));
