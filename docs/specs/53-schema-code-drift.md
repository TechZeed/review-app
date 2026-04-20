# Spec 53 — Schema-code drift: missing columns & extensions

**Owner:** in-flight (this branch) · **Date:** 2026-04-20 · **Status:** Draft → fixing inline
**Severity:** Blocker — recruiter search 500s + new `/subscriptions/portal` 500s on every fresh DB.
**Related:** Spec 50 (recruiter_blocks — fixed but exposed this), Spec 51 (Stripe portal), Spec 12 (recruiter search).

## Problem (live, reproducible on fresh local DB)

After applying all 14 migrations on local Postgres:

```bash
$ curl -X POST localhost:6510/api/v1/recruiter/search -H 'authorization: Bearer …' -d '{"query":"ramesh"}'
{"error":"column p.search_vector does not exist"}    # 500

$ curl -X POST localhost:6510/api/v1/subscriptions/portal -H 'authorization: Bearer …' -d '{}'
{"error":"column \"stripe_price_id\" does not exist"} # 500
```

## Root cause — three-way drift

The repos write raw SQL referencing columns that:
1. The migrations **don't create**
2. The Sequelize model **doesn't declare**

| Place | `subscriptions.stripe_price_id` | `subscriptions.billing_cycle` | `subscriptions.quantity` | `profiles.search_vector` | `pg_trgm` extension (for `p.location %` op) |
|---|---|---|---|---|---|
| Migrations | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sequelize model | ❌ | ❌ | ❌ | n/a | n/a |
| Repo SQL (`subscription.repo.ts`, `recruiter.repo.ts`) | ✅ reads/writes | ✅ reads/writes | ✅ reads/writes | ✅ filters on it | ✅ uses `%` operator |

Likely history: someone wrote the queries assuming Sequelize sync would create the columns, but Umzug controls schema in this repo, not sync.

## Fix — one additive migration

New file `apps/api/src/db/migrations/20260420-0002-fix-schema-drift.ts`:

1. `CREATE EXTENSION IF NOT EXISTS pg_trgm` — enables `%` similarity operator.
2. `ALTER TABLE subscriptions ADD COLUMN stripe_price_id varchar(255)` — nullable, populated by webhook handler when Stripe assigns the price.
3. `ALTER TABLE subscriptions ADD COLUMN billing_cycle varchar(20)` — values `monthly | annual`, nullable for free tier rows.
4. `ALTER TABLE subscriptions ADD COLUMN quantity integer NOT NULL DEFAULT 1` — for per-seat / per-location billing.
5. `ALTER TABLE profiles ADD COLUMN search_vector tsvector` — full-text search across headline + bio + industry + location.
6. `CREATE INDEX profiles_search_vector_idx ON profiles USING gin (search_vector)`.
7. `CREATE INDEX profiles_location_trgm_idx ON profiles USING gin (location gin_trgm_ops)` — supports `p.location %` queries.
8. Backfill `UPDATE profiles SET search_vector = to_tsvector('english', coalesce(headline,'') || ' ' || coalesce(bio,'') || ' ' || coalesce(industry,'') || ' ' || coalesce(location,''))`.
9. Trigger to auto-update `search_vector` on insert/update.

`down()` reverses each step in reverse order.

Also update **`apps/api/src/modules/subscription/subscription.model.ts`** to declare `stripePriceId`, `billingCycle`, `quantity` on `SubscriptionAttributes` + `Subscription.init` so Sequelize stays in sync with the DB.

## GIVEN / WHEN / THEN

- **GIVEN** a fresh DB **WHEN** `task local:migrate` runs **THEN** the new columns + indexes + trigger exist.
- **GIVEN** Rachel logged in **WHEN** she POSTs `/recruiter/search {"query":"ramesh"}` **THEN** API returns 200 with results, not 500.
- **GIVEN** Ramesh (active subscriber, with a `stripe_customer_id` row) **WHEN** he POSTs `/subscriptions/portal` **THEN** API returns 200 with a `portalUrl` (assuming Stripe Portal is configured — separate from this spec).
- **GIVEN** a profile is updated (headline/bio/industry/location) **THEN** `search_vector` is auto-recomputed by the trigger.

## Don't touch

- The repo SQL — it's correct, the schema was wrong.
- Sequelize sync (still off — Umzug only).
- Stripe Portal config or webhooks — that's Spec 54.

## Files

- `apps/api/src/db/migrations/20260420-0002-fix-schema-drift.ts` (new)
- `apps/api/src/modules/subscription/subscription.model.ts` (declare new fields)
