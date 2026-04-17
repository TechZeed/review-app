# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product in one line

Portable individual-owned review/reputation platform. Customers scan a QR code, leave a 10-second review (2 qualities + thumbs up + optional voice/video/text). Reviews belong to the individual — they stay if the person changes employers. Orgs are "guests" on individual profiles. Revenue from employer/recruiter subscriptions. Core insight: "every individual is a brand". See `docs/prd/` and `docs/brainstorms/` for details.

## Monorepo layout

- `apps/api/` — Node 23 + Express 5 + TypeScript + Sequelize + Postgres 16. Entry `src/server.ts`. Port 3000. Firebase Admin SDK for auth, Stripe for subs, GCP Secret Manager fallback via `ConfigResolver`.
- `apps/web/` — React 19 + Vite + Tailwind. Public review submission flow (QR → rate). Route `/r/:slug`.
- `apps/ui/` — React 19 + Vite + React Query + Firebase Web SDK + Tailwind. Logged-in dashboard for reviewees + admins. Has PWA manifest for install-to-home-screen.
- `apps/mobile/` — Expo 54 + Expo Router + React Native + Firebase. Reviewee daily loop (sign-in, profile, reviews, share QR). Deep link scheme: `reviewapp://`. Bundle: `sg.reviewapp.app`.
- `deploy.js` — Node orchestrator. Deploys any app (or all) to Cloud Run, wires `--set-env-vars` + `--set-secrets`.
- `docs/prd/` — what we're building and why. `docs/specs/` — how. `docs/deployment-guide.md` — infra.
- `infra/dev/` — local dev tooling (scripts called from Taskfile).

## Commands

### Taskfile is the primary interface

Taskfiles live under `apps/api/` (not repo root). Always run from there:

```bash
cd apps/api
task <label>:<task>
```

Three environment labels, each with its own dotenv scope:

- `local:*` → reads `.env` (local Postgres on `:6132`, mock Firebase/Stripe)
- `dev:*` → reads `.env.dev` (dev Cloud SQL via proxy on `:6199`, real dev GCP)
- `test:*` → reads `.env.test` (Testcontainers on `:10532`)

**Do not add `dotenv:` inside the included Taskfiles** — Task 3 forbids it and it would leak across envs. Scope lives only at the include site (`Taskfile.yml`). See memory file `feedback_taskfile_include_dotenv.md`.

Key tasks (all under `dev:` unless noted):

- `dev:startproxy` — Cloud SQL Auth Proxy on `:6199`
- `dev:migrate`, `dev:migrate:down`, `dev:migrate:status`
- `dev:seed`, `dev:seed:down`, `dev:seed:status`
- `dev:deploy:api | deploy:web | deploy:ui | deploy:all` — Cloud Run deploy
- `dev:logs` — live stream Cloud Run logs (tees to `devlogs.log`)
- `dev:sync:vault` — distribute `.env.dev` to GCP Secret Manager + GitHub Secrets
- `dev:mobile:config` — render `apps/mobile/eas.json` from `eas.template.json`
- `dev:deploy:mobile` — Android AAB → Play internal (uses `--local`)
- `dev:deploy:mobile:preview` — Android APK (preview profile)
- `dev:deploy:mobile:ios` — iOS IPA → TestFlight
- `dev:deploy:mobile:*:cloud` — same, but EAS cloud (fallback only — queue is slow)

**Per-app scripts** (when not using Taskfile):

| App | dev | build | test |
|---|---|---|---|
| api | `npm run dev` | `npm run build` | `npm run test` (vitest) |
| web | `npm run dev` | `npm run build` | — |
| ui | `npm run dev` | `npm run build` | — |
| mobile | `npm run start` | `eas build --local ...` | — |

**api/run.sh wrapper** — `./run.sh <local|dev|test> <server|migrate|seed|psql|test|build>`. Loads the right env file, runs the command. Used internally by Taskfile tasks.

**Single vitest file**: `cd apps/api && npx vitest run path/to/file.test.ts`.

## `.env.dev` is the single source of truth

Section headers in `.env.dev` are **parsed by scripts** — do not rename:

- `##### GCP Secrets #####` — `infra/dev/sync-vault.ts` pushes each key to GCP Secret Manager (with `review-*` prefix mapping, matches `SECRET_MAP` in `apps/api/src/config/configResolver.ts`).
- `##### GitHub Secrets #####` — same script pushes these via `gh secret set` for CI.
- `##### Local #####` — stays here, used only for local dev runs.

App runtime code **must not read `.env.dev` in production**. It reads `process.env` which is populated by Cloud Run `--set-env-vars` / `--set-secrets`. `ConfigResolver` falls back to GCP Secret Manager if an env var is missing.

`apps/mobile/eas.json` is **generated** from `apps/mobile/eas.template.json` using `${APPLE_ID}`, `${APPLE_TEAM_ID}`, `${ASC_APP_ID}` from `.env.dev`. `eas.json` is gitignored. The render script is `infra/dev/apply-eas-config.ts`; `dev:mobile:config` task runs it and is a dep of every `deploy:mobile*` task.

## Architectural patterns worth knowing

**ConfigResolver** (`apps/api/src/config/configResolver.ts`): `resolveConfig(key)` → check `process.env` first, then GCP Secret Manager (with name mapped via `SECRET_MAP`), then default. `resolveAllSecrets()` runs at startup so Zod env schema always sees a populated `process.env`.

**Review flow anti-fraud** (spec 06): QR scan → `/reviews/scan/:slug` returns a review token → OTP send/verify → `/reviews/submit` with the token. Device fingerprint required on scan. Review cooldown 7 days, token expiry 48h.

**Auth** (spec 16): dual auth. Google (Firebase) for self-service signup → default role `INDIVIDUAL`. Email/password only for admin-created accounts. Role upgrades (INDIVIDUAL → EMPLOYER/RECRUITER) require admin approval + subscription.

**Database** (spec 02): Postgres + Sequelize. Migrations via Umzug in `apps/api/src/db/`. Connection mode auto-detected (unix socket in Cloud Run via `K_SERVICE`/`CLOUDSQL_CONNECTION_NAME`, TCP elsewhere).

**Mobile API gaps** (spec 19): the mobile app logs API contract mismatches here instead of fixing the API mid-build. Current entries: `deviceFingerprint` missing, `name` returns headline, `firebaseToken` vs `firebaseIdToken` rename, `/profiles/me` missing `qualityBreakdown`.

## Non-obvious gotchas

- **Android local build** needs JDK 17 (pinned via `apps/mobile/.java-version`) and `apps/mobile/.npmrc` with `legacy-peer-deps=true` (react/react-dom peer conflict). `expo-linking` is a required peer of `expo-router` — keep it installed.
- **iOS local build** needs full Xcode (not just `xcode-select` CLI tools). Without full Xcode, `dev:deploy:mobile:ios:cloud` is the fallback.
- **Local Postgres, not Cloud SQL proxy, for "local" work** — `.env` uses `:6132` and is meant for Docker Postgres on localhost. `cloud-sql-proxy` is a dev-against-cloud mode, not a local mode.
- **Spec number collisions** in `docs/specs/` — two specs exist at `17-*.md`, `19-*.md`, `20-*.md`, `21-*.md` (result of parallel merges). Consolidate before adding new specs at those numbers.
- **EAS builds must be `--local` by default** — cloud queue is slow (often 20–60 min in IN_QUEUE). Cloud is a last-resort fallback.
- **Seeded profile slugs** (dev DB): `sarah-williams`, `ramesh-kumar`, `priya-sharma`, `david-chen`, `lisa-tan`, `ahmed-hassan`. Use these for local/dev testing.
- **GCP project is `humini-review`, region `asia-southeast1`.** Cloud SQL connection string: `humini-review:asia-southeast1:review-db-dev`. Don't hardcode these — they live in `.env.dev`.

## Memory

Project-scoped memory at `~/.claude/projects/-Users-muthuishere-muthu-gitworkspace-bossbroprojects-review-workspace-review-app/memory/MEMORY.md`. Load its entries before acting on env-/build-/deploy-related requests — they encode past corrections. Current entries cover: local-Postgres-for-local-dev rule, EAS-must-be-local rule, Taskfile include-site dotenv rule.

Huddle notes at `~/config/.m-agent-skills/review-app/main/huddle/` hold decisions (d1..d18) and historical context from working sessions.
