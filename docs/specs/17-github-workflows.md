# Spec 17: GitHub Workflows

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-16 (rewritten 2026-04-18 — manual-only + mobile CI pipeline)

---

## Rule zero — manual-only

Every workflow triggers on `workflow_dispatch` (or `workflow_call`) **only**. Never `push`, `pull_request`, or `schedule`. This keeps us on the GitHub free tier — we pay for minutes only when a human deliberately runs something. PRs still get local checks via `task local:test` / `task local:build`; we do not gate merges on a CI run.

If you find yourself adding `on: push:` or `on: pull_request:`, stop — restructure as a reusable `workflow_call` pulled in by a dispatch entry point.

---

## Workflows

| File | Purpose | Trigger | Confirmation input |
|---|---|---|---|
| `ci.yml` | Lint/typecheck/test (called by others or run manually) | `workflow_dispatch`, `workflow_call` | — |
| `deploy.yml` | Cloud Run deploy (api / web / ui / all) | `workflow_dispatch` | type `deploy` |
| `migrate.yml` | Run DB migrations against dev/prod | `workflow_dispatch` | type `migrate` |
| `deploy-mobile.yml` | Android build + Play submit + GH Release | `workflow_dispatch` | type `deploy-mobile` |

All confirmation inputs are a free-text field that must match a magic string — a guardrail, not security.

---

## `deploy-mobile.yml` — the mobile pipeline

This is the workflow we rely on instead of local EAS builds. Local builds broke for three reasons we kept hitting: stale rendered `app.json`, `JAVA_HOME` pointing at JDK 25 instead of 17, and missing TTY when invoking `eas` from wrappers. The runner has none of those problems.

**Inputs:**

| Input | Values | Meaning |
|---|---|---|
| `profile` | `preview` \| `production` | preview = APK for sideload; production = AAB for Play |
| `submit` | bool | Submit production AAB to Play Internal via EAS Submit |
| `release` | bool | Attach artifact to a GitHub Release tagged `mobile-<profile>-<timestamp>` |
| `confirm` | `deploy-mobile` | Guardrail |

**Pipeline:**

1. Set up Node 20 + Bun + JDK 17 (Temurin) on `ubuntu-latest`.
2. `npm ci` under `apps/mobile`.
3. **Render templates**: run `bun run infra/scripts/apply-mobile-config.ts` with every `app.template.json` / `eas.template.json` placeholder exposed as `env:` from GH Secrets. This writes the gitignored `apps/mobile/{app,eas}.json` the runner needs before `eas build` reads them.
4. `expo/expo-github-action@v8` logs in with `secrets.EXPO_TOKEN`.
5. `eas build --local --non-interactive --output ./…` — works in CI because step 3 already wrote the projectId + package name.
6. If `profile=production && submit=true`: decode `secrets.EAS_SUBMIT_SA_B64` to `google-service-account.json` and `eas submit --path ./build.aab`.
7. Always (`success() || failure()`): upload the artifact (14d retention) and, if `release=true`, create the GitHub Release with the AAB/APK attached.

The "always capture" on step 7 matters: when Play submit fails (e.g. service account missing app access) the AAB is still downloadable from the run's artifacts and Release — you don't have to rebuild.

**Required GH Secrets** (populated by `task dev:sync:vault` from `.env.dev`):

- `EXPO_TOKEN`, `EXPO_OWNER`, `EXPO_PROJECT_ID`
- `APPLE_ID`, `APPLE_TEAM_ID`, `ASC_APP_ID` (reserved for iOS — see below)
- `MOBILE_FIREBASE_*`, `MOBILE_API_URL`, `MOBILE_DASHBOARD_URL`, `MOBILE_WEB_URL`
- `GOOGLE_OAUTH_WEB_CLIENT_ID`, `GOOGLE_OAUTH_ANDROID_CLIENT_ID`, `GOOGLE_OAUTH_IOS_CLIENT_ID`
- `EAS_SUBMIT_SA_B64` — base64 of the Play Store submit SA JSON, pushed by `task dev:sync:vault` from the `##### GitHub Vault Files #####` entry `EAS_SUBMIT_SA_PATH=infra/dev/vault/eas-submit-sa.json`. The workflow decodes it to `google-service-account.json` at runtime. (The legacy `GOOGLE_PLAY_SA_KEY` secret is obsolete — superseded by this vault-managed key.)

**Prerequisites that live outside the workflow:**

- First Play Store submission for `sg.reviewapp.app` done manually once — Google blocks API submits until then.
- Play service account (`eas-submit@humini-review.iam.gserviceaccount.com`) granted Release-manager (or Admin) access to the ReviewApp under Play Console → Users and permissions.
- Tester email list created under Play Console → Internal testing → Testers.

**iOS (reserved, not yet wired):**

EAS Submit for iOS uses an App Store Connect API key, not a Google-style SA. When we add the iOS path:

1. Generate a key under App Store Connect → Users and Access → **Integrations** (role: App Manager). Download the `.p8`.
2. Add `ASC_API_KEY_ID` and `ASC_API_ISSUER_ID` under `##### GitHub Secrets #####` in `.env.dev`.
3. Put the `.p8` at `infra/dev/vault/asc-api-key.p8` and declare `ASC_API_KEY_PATH=infra/dev/vault/asc-api-key.p8` under `##### GitHub Vault Files #####`.
4. `task dev:sync:vault` pushes both — the file goes as base64, decoded by `.github/actions/hydrate-vault` at workflow start.
5. Extend `deploy-mobile.yml` with an `ios` profile branch calling `eas build --platform ios` and `eas submit --platform ios`.

TestFlight **tester** enrolment is separate (App Store Connect → My Apps → ReviewApp → TestFlight → Internal Testing).

---

## `deploy.yml` — Cloud Run

Dispatches `infra/scripts/deploy.js` inside the runner. Input `service` picks `api` / `web` / `ui` / `all`. Same two-layer env applies: committed `application.<env>.env` defaults + `--set-env-vars` / `--set-secrets` from GH Secrets override.

---

## `migrate.yml`

Runs `infra/scripts/run.sh <env> migrate`. Separate workflow so we can migrate without redeploying.

---

## `ci.yml`

Reusable (`workflow_call`). Lint, typecheck, vitest, integration (Postgres service container), Docker build. No automatic trigger — other dispatch workflows invoke it as a pre-step, or it can be run manually.

---

## Adding a new workflow — checklist

1. Trigger is `workflow_dispatch` (and `workflow_call` if reusable). Nothing else.
2. First input is a `confirm:` string matching the workflow name.
3. Any env-varying value comes from `secrets.*` (populated by `task dev:sync:vault`) — no literals in YAML.
4. Files on disk (`google-services.json`, `firebase-sa.json`, `.p8`) come from either a full-JSON secret written inline *or* the `##### GitHub Vault Files #####` section via `.github/actions/hydrate-vault` (spec 22).
5. Mirror any new `dev:*` deploy task under a `prod:*` workflow scope — don't ship dev-only deploy paths.
6. Update the table above.
