# Spec 25 — Regression Suite (Dev E2E)

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Draft
**Decisions:** d25 (revised by d29), d26, d27, d29, d30, d31

---

## 1. Problem

After every `task dev:deploy:all` (or GH-dispatched `deploy.yml`) we want a single signal that says *"dev is shippable"*. Today that signal is an API `/health` smoke test — it proves the process booted, nothing more. It doesn't prove a user can scan a QR, submit a review, log into the dashboard, or that the subscription webhook lands correctly.

A regression suite fills that gap: a small, opinionated set of end-to-end flows that hit the deployed dev stack the way a real user would, and assert the expected DB state afterwards.

## 2. Goals

- **Catch regressions before testers do.** If the golden path breaks after a deploy, the suite fails and we roll back before touching TestFlight / Play Internal.
- **Validate the full production-shaped stack**: deployed Cloud Run containers, real Firebase Auth, real Cloud SQL Postgres, real Stripe test keys, real CORS, real CDN/edge for the frontends.
- **Deterministic cleanup.** Tests must never leak data into dev that another teammate can trip on. Every mutation is tagged and reversible.
- **Under 5 minutes** wall-time for the full suite. Dev is not a CI playground — we pay Cloud Run request cost per run.

## 3. Non-goals (v1)

- No mobile (Maestro) driver — deferred to v1.5. Web + dashboard UI only.
- No local-env target. v1 only runs against dev. Local-target regression deferred; for local we already have integration tests under `apps/api/tests/` (spec 20).
- No load / performance testing. Happy path + a few "expected failure" assertions only.
- No prod target — will be re-scoped when prod goes live, with stricter isolation.
- No scheduled / auto-trigger runs. Manual `workflow_dispatch` only (repo-wide rule, spec 17).

## 4. Architecture

### 4.1 Drivers

| Surface | Driver | Why |
|---|---|---|
| `review-scan.teczeed.com` (public QR flow) | Playwright (CDP) | Fast, multi-context, headless Chromium. Scanner flow is a classic SPA. |
| `review-dashboard.teczeed.com` (reviewee UI) | Playwright (CDP) | Same runner as above — one install, one config. |
| `review-api.teczeed.com` | fetch via Playwright's `APIRequestContext` | Shared base URL, shared cookie jar, no extra HTTP lib needed. |
| Cloud SQL Postgres (assertions) | `pg` client via cloud-sql-proxy on `localhost:6199` | Read-only from tests; validates the DB actually got the mutation, not just the 2xx response. |

**CDP over WebDriver**: Playwright's default transport. ~3–5× faster than WebDriver on SPAs and supports multi-context scenarios (reviewer phone + reviewee dashboard simultaneously).

### 4.2 Fixtures — hybrid identity / throwaway model (d26)

**Shared identity pool** (read-only during tests):
- `ramesh@reviewapp.demo` — INDIVIDUAL, PRO tier
- `priya@reviewapp.demo` — INDIVIDUAL, FREE
- `sarah@reviewapp.demo` — INDIVIDUAL, FREE
- `james@reviewapp.demo` — EMPLOYER, DASHBOARD tier
- `rachel@reviewapp.demo` — RECRUITER, ACCESS tier
- `admin@reviewapp.demo` — ADMIN

All log in with `DEFAULT_SEED_PASSWORD=Demo123` via the email+password path (spec 16 — gated on by `VITE_FEATURE_EMAIL_LOGIN=true` and `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true` in dev).

Tests may *read* these users' profiles, but **never mutate** them. Mutations to profile fields, role, status, or subscription for any seeded user = bug.

**Per-run throwaway data** (tagged):
Every row the suite creates is tagged with a `test_run_id uuid` column. Cleanup is:

```sql
DELETE FROM media              WHERE test_run_id = $1;
DELETE FROM reviews            WHERE test_run_id = $1;
DELETE FROM review_tokens      WHERE test_run_id = $1;
DELETE FROM role_requests      WHERE test_run_id = $1;
DELETE FROM subscriptions      WHERE test_run_id = $1 AND plan LIKE 'test-%';
```

Run in an `afterAll` per suite. On crash, a `task dev:test:sweep` cleans anything with `test_run_id` older than 24h.

### 4.3 DB helper — `withDbProxy`

```ts
// apps/regression/src/lib/dbProxy.ts
import { Client } from "pg";
import { spawn, type ChildProcess } from "node:child_process";

export async function withDbProxy<T>(
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const proxy = spawn("cloud-sql-proxy", [
    process.env.CLOUDSQL_CONNECTION_NAME!,
    "--port=6199",
  ]);
  await waitForPort(6199);
  const client = new Client({
    host: "localhost",
    port: 6199,
    database: process.env.POSTGRES_DB,
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
  });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
    proxy.kill("SIGTERM");
  }
}
```

Spawned per **suite**, not per test. Suite-level fixture in Playwright.

## 5. Directory layout

```
apps/regression/
  package.json                    # own workspace; deps = @playwright/test, pg
  playwright.config.ts            # baseURL from env; projects = scanner, dashboard, api
  .gitignore                      # test-results/, playwright-report/
  src/
    lib/
      dbProxy.ts                  # cloud-sql-proxy spawn + pg client helper
      api.ts                      # thin fetch wrapper; attaches bearer tokens
      auth.ts                     # loginAs(email) → token + cookies
      runContext.ts               # testRunId generator + tagging helpers
    fixtures/
      users.ts                    # seeded-user handles (email + role)
      testRun.ts                  # Playwright fixture creating runContext
    flows/
      01-scanner.spec.ts          # Flow 1 — QR scan → review submit
      02-dashboard.spec.ts        # Flow 2 — reviewee sees their reviews
      03-role-upgrade.spec.ts     # Flow 3 — role request → admin approve
      04-subscription.spec.ts     # Flow 4 — employer subscribe → webhook
      05-cross-stack.spec.ts      # Flow 5 — mobile-written data visible in web (stub until v1.5)
    sweep.ts                      # `task dev:test:sweep` entrypoint
```

Own workspace (not `tests/regression/`) so Playwright's heavy deps don't pollute api / web / ui node_modules.

## 6. Run lifecycle

```
task dev:test:regression        (or workflow_dispatch regression.yml)
  │
  ├─ load .env.regression         ← vault-pattern, gitignored
  ├─ spawn cloud-sql-proxy
  ├─ connect pg client
  ├─ generate testRunId = uuid()
  ├─ run Playwright suites
  │    ├─ scanner.spec      → creates reviews tagged with testRunId
  │    ├─ dashboard.spec    → reads; no mutation
  │    ├─ role-upgrade.spec → creates role_request tagged
  │    └─ subscription.spec → creates test-plan subscription tagged
  ├─ afterAll: DELETE * WHERE test_run_id = $testRunId
  └─ proxy teardown
```

Exit code 0 → dev is green. Non-zero → rollback.

## 7. Schema change (d31)

**New migration**: `apps/api/src/db/migrations/20260419-0001-test-run-id.ts`

Adds `test_run_id UUID NULL` to these tables:

- `reviews`
- `review_tokens`
- `role_requests`
- `subscriptions`
- `media`

All nullable — production traffic writes NULL; only the regression suite writes a value. Indexed on `test_run_id` for fast cleanup:

```sql
CREATE INDEX reviews_test_run_id_idx ON reviews (test_run_id) WHERE test_run_id IS NOT NULL;
```

(Partial index — rows with NULL don't take index space.)

API surface change: `POST /reviews/submit`, `POST /role-requests`, `POST /subscriptions` accept an optional `testRunId` field in request body, gated behind `APP_ENV !== 'prod'`. In prod the field is silently dropped. Validates the "tests can't run against prod" invariant at the API level, not just at the client.

## 8. The 5 golden flows

### Flow 1 — Scanner (QR → review submit)
1. Visit `https://review-scan.teczeed.com/r/ramesh-kumar` (seeded slug).
2. Assert quality picker rendered.
3. Select 2 qualities (`expertise`, `care`), thumbs-up, leave a short text review.
4. Enter test phone `+6500000<random>`, request OTP.
5. API returns `debug_otp` field when `APP_ENV=dev` (existing behavior) — grab + submit.
6. Assert confirmation UI.
7. `withDbProxy`: `SELECT id FROM reviews WHERE test_run_id = $1` → expect 1 row.

### Flow 2 — Dashboard (reviewee sees their reviews)
1. `loginAs("ramesh@reviewapp.demo")` on `review-dashboard.teczeed.com`.
2. Navigate to `/reviews`.
3. Assert the review created in Flow 1 appears (match by text snippet).
4. No DB write.

### Flow 3 — Role upgrade (individual → employer, admin approve)
1. `loginAs("priya@reviewapp.demo")` on dashboard.
2. Submit role-upgrade form with test company name.
3. `withDbProxy`: `SELECT status FROM role_requests WHERE test_run_id = $1` → `pending`.
4. Logout → `loginAs("admin@reviewapp.demo")`.
5. Admin panel → approve the request.
6. `withDbProxy`: re-query → `approved`; re-query `users` → priya's role still `INDIVIDUAL` (approval doesn't auto-mutate — explicit second step per spec 16). Mark flow passed.
7. Cleanup: test_run_id cleanup + revert admin-side note.

### Flow 4 — Subscription (employer subscribes, webhook)
1. `loginAs("james@reviewapp.demo")` on dashboard.
2. Navigate to billing, pick test plan `test-employer-small`.
3. Stripe test card `4242 4242 4242 4242`.
4. Assert 2xx from checkout.
5. Wait up to 30s for webhook: poll `withDbProxy: SELECT status FROM subscriptions WHERE test_run_id = $1 AND status = 'active'` → expect 1 row.
6. Cleanup.

### Flow 5 — Cross-stack (mobile → web) [v1.5 stub]
v1: asserts contract-level — call `POST /reviews/submit` directly with mobile-shaped payload, verify `GET /profiles/:slug` returns it. v1.5 replaces with Maestro flow on a dev-pointed APK.

## 9. Auth

Per spec 16, email+password is gated by:
- Web/UI: `VITE_FEATURE_EMAIL_LOGIN=true` (already set for dev, per `deploy.yml`).
- Mobile: `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true` (already set in bundle, per .env.dev).

`loginAs(email)`:
```ts
const res = await api.post("/auth/login", { email, password: process.env.DEFAULT_SEED_PASSWORD });
return res.body.token;
```

Token stored on the Playwright context (`storageState`) so subsequent navigations inherit it.

## 10. Env config (d27)

### Local file
`.env.regression` at repo root (gitignored). Vault-pattern — contents synced to GCP Secret Manager as `review-regression-bundle` (same pattern as `review-dev-bundle`, new secret, separate IAM).

Contents:

```ini
# Target env (the deployed URLs)
REGRESSION_API_URL=https://review-api.teczeed.com
REGRESSION_SCAN_URL=https://review-scan.teczeed.com
REGRESSION_DASHBOARD_URL=https://review-dashboard.teczeed.com

# DB assertion layer — Cloud SQL Auth Proxy target
CLOUDSQL_CONNECTION_NAME=humini-review:asia-southeast1:review-db-dev
POSTGRES_DB=dev_review_db
POSTGRES_USER=review_user
POSTGRES_PASSWORD=<from .env.dev>

# Auth
DEFAULT_SEED_PASSWORD=Demo123

# Stripe test
STRIPE_PUBLISHABLE_KEY=<same as dev>
```

### GitHub environment
New GH **environment** `ci-regression` (not repo-wide secret). Same keys as above. The `regression.yml` workflow references `environment: ci-regression`, scoping secrets to just this workflow. Teammates with repo write access do not automatically get regression secrets.

## 11. Task runner integration

```yaml
# Taskfile.dev.yml (new tasks)
test:regression:
  desc: Run full E2E regression suite against dev
  dir: "{{.REPO_ROOT}}/apps/regression"
  cmd: bun run --env-file={{.REPO_ROOT}}/.env.regression npx playwright test

test:regression:ui:
  desc: Run regression suite with Playwright UI mode
  dir: "{{.REPO_ROOT}}/apps/regression"
  cmd: bun run --env-file={{.REPO_ROOT}}/.env.regression npx playwright test --ui

test:sweep:
  desc: Clean up any test_run_id rows older than 24h in dev DB
  cmd: bun run --env-file={{.REPO_ROOT}}/.env.regression {{.REPO_ROOT}}/apps/regression/src/sweep.ts
```

## 12. CI — `regression.yml`

```yaml
name: regression
on:
  workflow_dispatch:
    inputs:
      confirm:
        description: "Type 'regression' to confirm"
        required: true
        type: string

concurrency:
  group: regression
  cancel-in-progress: false

jobs:
  run:
    environment: ci-regression   # scoped secrets
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - uses: oven-sh/setup-bun@v2
      - name: Install
        working-directory: apps/regression
        run: npm ci && npx playwright install --with-deps chromium
      - name: Auth to GCP (for cloud-sql-proxy)
        uses: google-github-actions/auth@v2
        with: { credentials_json: ${{ secrets.GCP_SA_KEY }} }
      - uses: google-github-actions/setup-gcloud@v2
      - name: Install cloud-sql-proxy
        run: |
          curl -sSLo cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.11.0/cloud-sql-proxy.linux.amd64
          chmod +x cloud-sql-proxy
          sudo mv cloud-sql-proxy /usr/local/bin/
      - name: Run regression
        working-directory: apps/regression
        env:
          REGRESSION_API_URL: ${{ secrets.REGRESSION_API_URL }}
          REGRESSION_SCAN_URL: ${{ secrets.REGRESSION_SCAN_URL }}
          REGRESSION_DASHBOARD_URL: ${{ secrets.REGRESSION_DASHBOARD_URL }}
          CLOUDSQL_CONNECTION_NAME: ${{ secrets.CLOUDSQL_CONNECTION_NAME }}
          POSTGRES_DB: ${{ secrets.POSTGRES_DB }}
          POSTGRES_USER: ${{ secrets.POSTGRES_USER }}
          POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
          DEFAULT_SEED_PASSWORD: ${{ secrets.DEFAULT_SEED_PASSWORD }}
        run: npx playwright test
      - name: Upload report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/regression/playwright-report
          retention-days: 7
```

## 13. Rollout plan

1. **Migration**: land the `test_run_id` column migration. Deploy API. Verify `application.*.env` + API endpoints accept the optional field in dev and drop it in prod.
2. **Workspace scaffold**: `apps/regression/` + `playwright.config.ts` + `dbProxy.ts` + `auth.ts`.
3. **Flow 1 (scanner)**: implement first, end-to-end, as the template. Review with Muthu.
4. **Flows 2–4**: implement in parallel once Flow 1 is the reference.
5. **Vault**: sync `.env.regression` → GCP Secret Manager as `review-regression-bundle`. Grant per-secret IAM to teammates.
6. **GH env `ci-regression`**: create, populate secrets, wire `regression.yml`.
7. **Documentation**: link from README + spec 23 (repo conventions).
8. **v1.5 (Maestro)**: after v1 has soaked for a week.

## 14. Open items (v1.5 / later)

- **Maestro mobile flows** — Android dev APK pointed at same dev API.
- **Scheduled nightly run** — blocked by free-tier rule (spec 17); re-open when we're off free tier.
- **Prod regression** — needs an isolated prod-shaped tenant; deferred until prod exists.
- **Visual regression** — Playwright has `toHaveScreenshot()`; add once core flows are stable, not before.

## 15. Invariants (don't violate)

- Seeded demo users are read-only from regression tests. Mutations to them = bug.
- Every suite-created row carries a `test_run_id`. No exceptions.
- No regression run against prod, ever. Enforced by API `APP_ENV !== 'prod'` check.
- No auto-trigger — `workflow_dispatch` only.
- Suite total runtime < 5min. If a flow crosses 90s, split it.
