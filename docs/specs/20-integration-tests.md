# Spec 20: Integration Test Stack

**Project:** ReviewApp
**Date:** 2026-04-17
**Status:** Initial cut done; needs infra hardening

---

## Why This Exists

Before this work, the ReviewApp deploy-to-dev loop was ~5 minutes per
iteration (docker build + push + Cloud Run deploy). Every frontend/API
contract mismatch — wrong URL path, wrong body shape, null-wired repos
— had to be caught by running Playwright against a live dev service.
Today's bugs (fingerprint length, route mismatch, repo nulled, OTP
route wrong) were all caught in production, not locally.

Decision (huddle, 2026-04-17): build a Testcontainers-based integration
test suite inside `apps/api/` that exercises the real Express app
against a real Postgres with real migrations and real seed — catching
this class of bug in seconds, not minutes.

**What this stack is for** (and isn't):

| In scope | Out of scope |
|---|---|
| API ↔ DB integration via supertest | Frontend rendering / Playwright |
| Email/password auth (`/auth/login`) | Firebase / Google sign-in |
| Mock SMS (sum-to-7 rule) | Real Twilio / SendGrid |
| Rate limits (skipped under NODE_ENV=test) | Rate-limit behaviour itself — separate windowed test |
| Scan / OTP / review submit / cooldown | Stripe checkout and webhooks |
| Route sanity (guards the `/otp/send` vs `/verification/otp/send` class) | GCS media upload |

Firebase, Stripe, and real SMS coverage will live in a future
**dev-environment-automation spec**, not here.

---

## Stack Shape

### Layout

```
apps/api/
├── docker-compose.test.yml      ← Postgres on 10532, MinIO profile ready
├── tests/
│   └── integration/
│       ├── setup.ts             ← thin harness (connect + import app)
│       ├── seed.ts              ← 4 internal-provider users + profiles + org
│       ├── seed-cli.ts          ← standalone seed entry for Taskfile
│       ├── auth.test.ts         ← /auth/login — 4 roles, JWT claims
│       ├── scan-review.test.ts  ← scan → otp → submit → reuse → cooldown
│       ├── fingerprint.test.ts  ← 16/128 char boundaries
│       └── routes.test.ts       ← every public frontend route is mounted
├── Taskfile.local.yml           ← test:db:up/down/migrate/seed/reset, test:integration
└── vitest.config.ts
.env.test                        ← repo root, source of truth
```

### Why docker-compose, not Testcontainers

Initial cut used the `testcontainers` library (embedded in tests). On Colima
this produced a 120s hook-timeout cascade: container boot ~15s, Ryuk-
disabled leftovers piling up, migrations via tsx subprocess adding ~10s,
and Vitest's default per-file module isolation defeating singleton caching
(4× container starts per run). Debugging each layer ate a session.

Switching to an external `docker-compose.test.yml` collapsed that to:
**16-second clean-start-to-green**. One container, one healthcheck-
gated wait, one migration+seed, then vitest. Orchestrated by a single
Taskfile `test:integration` with `defer: { task: test:db:down }` so
teardown always runs. Matches the `reqsume/e2e` convention the user
was already using elsewhere.

### Port scheme (locked — spec 20 scope)

All test-stack ports live in the **105xx** band so they never collide
with dev proxy (6199), local Vite/Express (5173 / 3000), or prod:

| Port | Service |
|---|---|
| 10500 | API (test) |
| 10532 | Postgres (test, Testcontainers-mapped) |
| 10573 | Web / scan Vite dev (future frontend-contract layer) |
| 10574 | UI / dashboard Vite dev (future) |
| 10510–10519 | Reserved |

### `.env.test` (repo root)

Only the keys tests actually need. No Firebase, no Stripe, no GCP surface:

```
NODE_ENV=test
PORT=10500
POSTGRES_HOST=localhost
POSTGRES_PORT=10532
POSTGRES_DB=test_review_db
POSTGRES_USER=test_user
POSTGRES_PASSWORD=test_password
JWT_SECRET=test-only-jwt-secret-do-not-reuse-in-any-other-environment
JWT_EXPIRATION_TIME_IN_MINUTES=60
SMS_PROVIDER=mock
FIREBASE_PROJECT_ID=test-fake        # required by zod, unused
GCP_BUCKET_NAME=test-bucket          # required by zod, unused
APP_URL=http://localhost:10500
FRONTEND_URL=http://localhost:10573
CORS_ORIGINS=http://localhost:10573,http://localhost:10574
REVIEW_TOKEN_EXPIRY_HOURS=48
REVIEW_COOLDOWN_DAYS=7
E2E_ADMIN_EMAIL=admin@test.local
E2E_ADMIN_PASSWORD=Test_Admin_Pass_007
E2E_INDIVIDUAL_EMAIL=individual@test.local
E2E_INDIVIDUAL_PASSWORD=Test_Individual_Pass_007
E2E_EMPLOYER_EMAIL=employer@test.local
E2E_EMPLOYER_PASSWORD=Test_Employer_Pass_007
E2E_RECRUITER_EMAIL=recruiter@test.local
E2E_RECRUITER_PASSWORD=Test_Recruiter_Pass_007
```

### Seed shape

4 users, all `provider: 'internal'`, bcrypt-hashed passwords, one per
role. Profiles + org with deterministic UUIDs so tests can reference
them.

```ts
interface SeededTestData {
  users: {
    admin: { id, email };
    individual: { id, email, profileSlug };
    employer: { id, email };
    recruiter: { id, email };
  };
  profiles: {
    primary: { id, slug };
    secondary: { id, slug }; // for cooldown scenarios
  };
  org: { id, slug };
}
```

Seed is **idempotent** — deletes any rows with the test UUIDs before
inserting, so repeated runs on the same container don't pile up state.

### Harness contract

```ts
bootstrapTestStack() -> {
  app: Express,
  sequelize: Sequelize,
  seeded: SeededTestData,    // fixtures only — DB was seeded externally
  teardown: () => Promise<void>
}
```

Internally (thin — docker-compose owns lifecycle):
1. `dotenv.config({ path: .env.test, override: true })` — beats the
   hardcoded process.env in `tests/utils/setup.ts`.
2. Dynamic import `initDb()` + `getSequelize()` — connects to the
   already-running docker-compose Postgres at `localhost:10532`.
3. Dynamic import `../../src/app.js` **last**, after env is finalised.
   This dodges the `env.ts` import-time snapshot that would otherwise
   lock in `tests/utils/setup.ts`'s hardcoded values.
4. Returns `getSeededTestData()` (fixture handles — no DB writes).
5. Teardown is a no-op; docker-compose teardown is a Task step.

---

## Running

```
# full orchestrated run (up → migrate → seed → vitest → down)
cd apps/api && task local:test:integration

# or piece by piece:
cd apps/api
task local:test:db:up         # start Postgres, wait healthy
task local:test:db:migrate    # run migrations
task local:test:db:seed       # insert fixtures
npm run test:integration      # run vitest
task local:test:db:down       # destroy (volume removed)
```

Warm clean-run on Colima: **~16s** end-to-end, 34/35 green (the one
remaining failure is spec-21 Bug #6 — cooldown schema gap). First run
adds the postgres:16-alpine image pull (~10–20s one-time).

---

## Extending the stack

When a test needs a non-DB backing service (S3/MinIO, Redis, Elasticsearch),
add it as a new service in `docker-compose.test.yml`. Use Compose
profiles to keep it opt-in:

```yaml
services:
  minio:
    image: minio/minio:latest
    profiles: ["media"]   # only starts with --profile media
    ports: ["10590:9000", "10591:9001"]
    ...
```

Enable in the run:
```
docker compose -f docker-compose.test.yml --profile media up -d --wait
```

Keep ports in the 105xx band. Commented MinIO block in the compose file
shows the pattern — uncomment and wire once a test actually exercises
real media upload (today's suite mocks `@google-cloud/storage` at the
SDK layer via `tests/utils/setup.ts`).

---

## Coexistence with the pre-existing `tests/utils/setup.ts`

The repo already had a global Vitest `setupFiles` that hardcodes
`process.env.POSTGRES_DB = "review_app_test"` and mocks Firebase /
Stripe / Twilio / GCS SDKs for unit tests. We deliberately kept it —
the SDK mocks are still useful for integration tests. The env
hardcoding is neutralised two ways:

1. `.env.test` is loaded with `override: true` inside `bootstrapTestStack`,
   beating the global setup's assignments.
2. The Express app is imported **dynamically after** dotenv runs, so
   `env.ts`'s import-time snapshot reflects the `.env.test` values, not
   the global-setup ones.

This is fragile by design — any future change that adds a **top-level**
`import { app }` to an integration test file will silently re-break
the env snapshot. A sharp edge documented in `setup.ts`.

---

## What's Next

- **Spec 21** (`21-verification-service-schema-alignment.md`) — catalogues
  the bugs this stack found, the ones fixed, and the one that needs a
  migration (`review_tokens` missing `phone_hash`/`used_at` columns).
- **Future: frontend-contract layer.** Playwright against local Vite +
  this same API stack. Same test code reusable against deployed dev
  URLs via a single `BASE_URL` env var.
- **Future: dev-env-automation spec.** Firebase Google-sign-in smoke,
  Stripe checkout with test cards, webhook delivery — against deployed
  dev URLs, not local.

---

## Files Added / Changed

| File | Role |
|---|---|
| `.env.test` | test-env source of truth (105xx ports, no Firebase/Stripe/GCP) |
| `apps/api/docker-compose.test.yml` | Postgres on 10532, commented MinIO profile |
| `apps/api/tests/integration/setup.ts` | thin harness (dotenv → initDb → dynamic app import) |
| `apps/api/tests/integration/seed.ts` | 4 internal-provider users + 2 profiles + 1 org; exports `seedTestData` + `getSeededTestData` |
| `apps/api/tests/integration/seed-cli.ts` | standalone seed runner (used by `test:db:seed`) |
| `apps/api/tests/integration/auth.test.ts` | login flow, JWT claims |
| `apps/api/tests/integration/scan-review.test.ts` | scan → otp → submit → reuse → cooldown |
| `apps/api/tests/integration/fingerprint.test.ts` | 16/128 char boundary |
| `apps/api/tests/integration/routes.test.ts` | route sanity (mount-existence) |
| `apps/api/vitest.config.ts` | `hookTimeout: 30000` (docker-compose + external DB means no 2-minute waits) |
| `apps/api/package.json` | `test:integration`, `test:db:migrate`, `test:db:seed` scripts; `dotenv` devDep |
| `apps/api/Taskfile.local.yml` | `test:db:up/down/migrate/seed/reset` + orchestrated `test:integration` with `defer` teardown |
