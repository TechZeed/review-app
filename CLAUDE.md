# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product in one line

Portable individual-owned review/reputation platform. Customers scan a QR code, leave a 10-second review (2 qualities + thumbs up + optional voice/video/text). Reviews belong to the individual — they stay if the person changes employers. Orgs are "guests" on individual profiles. Revenue from employer/recruiter subscriptions. Core insight: "every individual is a brand". See `docs/prd/` and `docs/brainstorms/` for details.

## Monorepo layout

- `apps/api/` — Node 23 + Express 5 + TypeScript + Sequelize + Postgres 16. Entry `src/server.ts`. Port 3000. Firebase Admin SDK for auth, Stripe for subs, GCP Secret Manager fallback via `ConfigResolver`.
- `apps/web/` — React 19 + Vite + Tailwind. Public review submission flow (QR → rate). Route `/r/:slug`.
- `apps/ui/` — React 19 + Vite + React Query + Firebase Web SDK + Tailwind. Logged-in dashboard for reviewees + admins. Has PWA manifest for install-to-home-screen.
- `apps/mobile/` — Expo 54 + Expo Router + React Native + Firebase. Reviewee daily loop (sign-in, profile, reviews, share QR). Deep link scheme: `reviewapp://`. Bundle: `sg.reviewapp.app`.
- `infra/scripts/deploy.js` — Node orchestrator. Deploys any app (or all) to Cloud Run, wires `--set-env-vars` + `--set-secrets`.
- `infra/scripts/run.sh` — wrapper for API dev-server/migrate/seed/psql/test/build. Called by the Taskfile; run directly only in emergencies.
- `docs/prd/` — what we're building and why. `docs/specs/` — how. `docs/deployment-guide.md` — infra.
- `infra/dev/` — other dev tooling (sync-vault, apply-mobile-config, etc., all invoked via Taskfile).

## Commands

### Taskfile is the primary interface

Taskfiles live at the **repo root** (`Taskfile.yml` + `Taskfile.{local,dev,test}.yml`). Run from anywhere inside the repo:

```bash
task <label>:<task>
```

Three environment labels, each with its own dotenv scope:

- `local:*` → reads `.env` (Docker-Compose Postgres on `:10032`, mock Firebase/Stripe)
- `dev:*` → reads `.env.dev` (dev Cloud SQL via proxy on `:6199`, real dev GCP)
- `test:*` → reads `.env.test` (Testcontainers on `:10532`)

Each label owns a port range (`local:10032+`, `dev:6199`, `test:10532`) so multiple stacks can coexist on the dev machine.

**Do not add `dotenv:` inside the included Taskfiles** — Task 3 forbids it and it would leak across envs. Scope lives only at the include site (`Taskfile.yml`). See memory file `feedback_taskfile_include_dotenv.md`.

Key tasks:

**Local** (Docker Postgres, mock external deps, `.env`):
- `local:bootstrap` — first-run setup: `infra:up` + wait-healthy + `migrate` + `seed`
- `local:dev` — day-to-day: ensure infra up, start API dev server
- `local:infra:up | down | reset | ps | wait` — manage the local docker-compose stack
- `local:server | migrate | seed | psql | test | build` — individual ops (thin wrappers over `infra/scripts/run.sh local …`)
- `local:stripe:listen` — forward Stripe webhooks to local API

**Dev** (deploys to GCP, reads `.env.dev`):
- `dev:deploy:api | deploy:web | deploy:ui | deploy:all` — Cloud Run deploy
- `dev:logs` — live stream Cloud Run logs (tees to `devlogs.log`)
- `dev:sync:vault` — push `.env.dev` strings + vault-file secrets to GCP Secret Manager + GitHub Secrets (`:dry` for preview)
- `dev:vault:pull [-- --force]` — fetch GCP vault files to `infra/dev/vault/` (new-machine bootstrap)
- `dev:mobile:config` — render `apps/mobile/{eas,app}.json` from templates
- `dev:deploy:mobile` — Android AAB → Play internal (uses `--local`)
- `dev:deploy:mobile:preview` — Android APK for tester sideload
- `dev:deploy:mobile:ios` — iOS IPA → TestFlight

**Test** (Testcontainers Postgres on `:10532`, `.env.test`):
- `test:integration` — full integration run (db:reset + vitest + teardown)

_Also available but rarely needed: `dev:startproxy` (Cloud SQL Auth Proxy on `:6199`), `dev:migrate`, `dev:seed`, `dev:deploy:mobile:*:cloud` (slow EAS cloud fallback). Normal dev work uses `local:*` against Docker Postgres._

**Single vitest file**: `cd apps/api && npx vitest run path/to/file.test.ts` (vitest resolves the test path relative to cwd, so stay in `apps/api`).

## `.env.dev` — source of truth for secrets & overrides

`.env.dev` holds **secrets and machine/tenant-specific values** (gitignored). Non-secret env-varying defaults live in `apps/api/config/application.<env>.env` (committed) — see the "Two-layer env pattern" section below.

Section headers in `.env.dev` are **parsed by scripts** — do not rename:

- `##### GCP Secrets #####` / `##### GitHub Secrets #####` / `##### Both #####` — pushed to the corresponding store by `infra/dev/sync-vault.ts`.
- `##### GCP Vault Files #####` / `##### GitHub Vault Files #####` — **file contents** pushed; see the file-vault pattern below.
- `##### Local #####` — stays local.

Runtime code **must not read `.env.dev` in production** — Cloud Run populates `process.env` via `--set-env-vars` / `--set-secrets`. `ConfigResolver` falls back to GCP Secret Manager if an env var is missing.

`apps/mobile/eas.json` **and** `apps/mobile/app.json` are both **generated** from `apps/mobile/eas.template.json` + `apps/mobile/app.template.json` using `${VAR}` placeholders sourced from `.env.dev`. Both output files are gitignored. The render script is `infra/dev/apply-mobile-config.ts`; `dev:mobile:config` task runs it and is a dep of every `deploy:mobile*` task. **Never edit `app.json` or `eas.json` directly — edit the `.template.json` and/or add the var to `.env.dev`.**

## Two-layer env pattern (API)

The API has two env layers, loaded in this precedence:

1. **`apps/api/config/application.<APP_ENV>.env`** — committed, non-secret defaults (log level, feature flags, tunables). Ships with the code. Loaded at startup by `loadAppEnvDefaults()` via dotenv `override:false`.
2. **`.env.<env>` at repo root** (gitignored) locally, OR Cloud Run `--set-env-vars` / `--set-secrets` in prod — **always wins**. Holds secrets, machine-specific values, and any explicit override.

Selector is `APP_ENV` (values: `local | dev | test | prod`). Exported by `infra/scripts/run.sh` (from its `$ENV` arg), by `infra/scripts/deploy.js` (derived from the deploy env), and by `Taskfile.local.yml` indirectly via run.sh. Falls back to `NODE_ENV` mapping if unset.

**Rules:**
- Never put secrets or URLs that differ between tenants/projects into `application.*.env` — those belong in `.env.*` (gitignored) or GCP Secret Manager.
- When adding a new env-varying default, edit all four `application.{local,dev,test,prod}.env` files at once; they're meant to stay in lockstep on keys (values may differ).
- The `config/` folder is copied into the Docker image (`Dockerfile: COPY config ./config`) so Cloud Run sees the file at runtime.

## File vault pattern

Binary/JSON credentials (service accounts, signing keys) live in `infra/dev/vault/` — gitignored, never committed. Paths are declared in `.env.dev` under two new sections:

- `##### GCP Vault Files #####` — contents pushed to GCP Secret Manager by `task dev:sync:vault`. Cloud Run mounts each as a file at `/secrets/<basename>` via `--set-secrets` (emitted by `infra/scripts/deploy.js`). App reads `process.env[KEY_PATH]` — locally a repo-root-relative path like `infra/dev/vault/firebase-sa.json` (resolved against REPO_ROOT inside the API), on Cloud Run an absolute `/secrets/…`.
- `##### GitHub Vault Files #####` — contents pushed to GitHub Secrets as base64. Decoded by `.github/actions/hydrate-vault` as the first step of any workflow that needs them.

**The `_PATH` suffix is load-bearing.** Keys must end in `_PATH` — `sync-vault.ts` uses it to detect file entries, and the API's startup `verifyVaultFiles()` sanity-check iterates every `*_PATH` env key and fails boot if any file is missing.

**Runtime contract:** `ConfigResolver.resolveFilePath(key)` returns the path. The app never calls Secret Manager for vault files at runtime — writing is the environment's job (Cloud Run mount, CI hydrate action, or `task dev:vault:pull` locally).

**New developer bootstrap:** `git clone` → fill `GCP_PROJECT_ID` in `.env.dev` → `gcloud auth login` → `task dev:vault:pull` → vault populated. See `docs/specs/22-file-vault-pattern.md`.

## Core rules — no hardcoding, always via task

These override convenience. If you catch yourself reaching for a raw CLI or typing a literal value into a config file, stop.

1. **`.env.dev` is the single source of truth for every env-varying value** — URLs, project IDs, keys, owner names, Firebase config, OAuth client IDs, mobile identifiers, all of it. If a value changes between local / dev / prod, it lives in `.env.*`, never in committed code or JSON.
2. **Committed JSON config files that vary by env must be generated from `.template.json`** (see `eas.template.json`, `app.template.json`). The rendered output is gitignored. New env-varying config → add a template, not a hardcoded file.
3. **Always invoke via `task <label>:<cmd>`, never raw `eas`, `gcloud`, `npx sequelize`, `eas build`, etc.** The task wraps dotenv scoping, deps (like `mobile:config`), and `--local` defaults. If a needed command has no task, add a task for it — don't run the raw CLI.
4. **Dev/prod parallel label pattern** — every deploy/build task defined under `dev:` must have a mirror under `prod:` that reads `.env.prod` at the include site in `Taskfile.yml`. Same task names, same shape, different env scope. Adding a dev task without the prod counterpart is a bug.
5. **GitHub Actions workflows are `workflow_dispatch` only — never `push` / `pull_request` / `schedule`.** We stay on the free tier by running CI/deploys manually. If a workflow needs another workflow's steps, use `workflow_call`. Do not add automatic triggers.

## Architectural patterns worth knowing

**ConfigResolver** (`apps/api/src/config/configResolver.ts`): `resolveConfig(key)` → check `process.env` first, then GCP Secret Manager (with name mapped via `SECRET_MAP`), then default. `resolveAllSecrets()` runs at startup so Zod env schema always sees a populated `process.env`.

**Review flow anti-fraud** (spec 06): QR scan → `/reviews/scan/:slug` returns a review token → OTP send/verify → `/reviews/submit` with the token. Device fingerprint required on scan. Review cooldown 7 days, token expiry 48h.

**Auth** (spec 16): dual auth. Google (Firebase) for self-service signup → default role `INDIVIDUAL`. Email/password only for admin-created accounts. Role upgrades (INDIVIDUAL → EMPLOYER/RECRUITER) require admin approval + subscription.

**Database** (spec 02): Postgres + Sequelize. Migrations via Umzug in `apps/api/src/db/`. Connection mode auto-detected (unix socket in Cloud Run via `K_SERVICE`/`CLOUDSQL_CONNECTION_NAME`, TCP elsewhere).

**Mobile API gaps** (spec 19): the mobile app logs API contract mismatches here instead of fixing the API mid-build. Current entries: `deviceFingerprint` missing, `name` returns headline, `firebaseToken` vs `firebaseIdToken` rename, `/profiles/me` missing `qualityBreakdown`.

## Non-obvious gotchas

- **Android local build** needs JDK 17 (pinned via `apps/mobile/.java-version`) and `apps/mobile/.npmrc` with `legacy-peer-deps=true` (react/react-dom peer conflict). `expo-linking` is a required peer of `expo-router` — keep it installed.
- **iOS local build** needs full Xcode (not just `xcode-select` CLI tools).
- **Local work uses local Docker Postgres** (`:10032`, driven by `infra/local/docker-compose.yaml`). Bootstrap a fresh machine with `task local:bootstrap` (Postgres + migrations + seed). Day-to-day: `task local:dev`.
- **Spec number collisions** in `docs/specs/` — two specs exist at `17-*.md`, `19-*.md`, `20-*.md`, `21-*.md` (result of parallel merges). Consolidate before adding new specs at those numbers.
- **EAS builds must be `--local` by default** — cloud queue is slow (often 20–60 min in IN_QUEUE). Cloud is a last-resort fallback.
- **Seeded profile slugs** (dev DB): `sarah-williams`, `ramesh-kumar`, `priya-sharma`, `david-chen`, `lisa-tan`, `ahmed-hassan`. Use these for local/dev testing.
- **GCP project is `humini-review`, region `asia-southeast1`.** Cloud SQL connection string: `humini-review:asia-southeast1:review-db-dev`. Don't hardcode these — they live in `.env.dev`.

## Memory

Project-scoped memory at `~/.claude/projects/-Users-muthuishere-muthu-gitworkspace-bossbroprojects-review-workspace-review-app/memory/MEMORY.md`. Load its entries before acting on env-/build-/deploy-related requests — they encode past corrections. Current entries cover: local-Postgres-for-local-dev rule, EAS-must-be-local rule, Taskfile include-site dotenv rule.

Huddle notes at `~/config/.m-agent-skills/review-app/main/huddle/` hold decisions (d1..d18) and historical context from working sessions.
