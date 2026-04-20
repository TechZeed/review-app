# Spec 17: GitHub Workflows

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-16 (rewritten 2026-04-18 — manual-only + mobile CI pipeline; amended 2026-04-19 — versionCode bump, iOS status, internal-only guardrail; amended 2026-04-19 — Play Console status CLI cross-ref, see spec 29; amended 2026-04-20 — releaseStatus flipped to `completed` for Internal track auto-rollout)

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

### Android versionCode management

`eas build --local` does **not** reliably honour `cli.appVersionSource: remote` + `build.production.autoIncrement: true` — the version bump that EAS would normally do server-side never reaches the local build, so the same `versionCode` ships twice and Play rejects the second submit with *"You've already submitted this version"*.

Fix (in effect 2026-04-19): `appVersionSource` is flipped back to `local`, and `deploy-mobile.yml` runs a `jq` step before `eas build` that rewrites `apps/mobile/app.json` with `versionCode = 100 + GITHUB_RUN_NUMBER`. `GITHUB_RUN_NUMBER` is workflow-scoped and monotonic, the `+100` offset keeps the CI-managed range well above manual versionCodes (last manual bump was 13).

The `app.json` edit is a runner-only mutation — never committed back. Preview builds (APK) skip the bump entirely, so sideload builds don't burn versionCode space.

### Debugging a release — `task dev:play:status`

After any `deploy-mobile` dispatch, verify what actually landed on Play without opening the browser:

```bash
task dev:play:status -- --track=internal
```

Prints the app's store-listing state and every release on the selected track (versionCode, status: `completed` / `draft` / `inProgress` / `halted`, release notes, rollout %). Uses the same `eas-submit-sa.json` this workflow already decodes for `eas submit` — no new credentials. See spec 29 for the full API surface and follow-ups.

### Versioning contract

Two fields on `apps/mobile/app.json` that Play cares about:

- `expo.android.versionCode` — integer, strictly monotonic per submit. Play rejects re-submits of the same code ("You've already submitted this version"). **Rewritten at runtime** by the jq step above to `100 + GITHUB_RUN_NUMBER`. Never committed.
- `expo.version` — the marketing string (`"1.0.0"`). Shown to testers/users. Currently fixed; bump by hand in a PR when user-visible behavior changes enough to warrant it. Semver is fine; we're not pinned to one convention yet.

The repo does **not** use EAS remote appVersionSource (`appVersionSource: remote` + `autoIncrement: true`). Spec 17 amendment 2026-04-19 documents why: `eas build --local` silently skips the server-side increment, causing duplicate-version submits. Our jq-based local bump is the workaround.

iOS has a parallel concept (`expo.ios.buildNumber`). Not CI-bumped yet because the iOS pipeline is still in the first-run-cert bootstrap stage (this spec §iOS path below). When we wire it, use the same `100 + GITHUB_RUN_NUMBER` trick for parity.

### Internal-testers-only guardrail

The Android submit config is `track: internal` + `releaseStatus: completed` (`apps/mobile/eas.json`).

**`track: internal` is the safety gate** — it's what keeps every CI build from reaching the public Play Store. Only testers added to Play Console → Internal testing → Testers see these builds, and only via the opt-in URL (not public Play Store browse). **Flipping `track` to `production` would be catastrophic** — don't do that without a separate spec.

**`releaseStatus: completed`** (changed 2026-04-20, was `draft`) — every CI submit auto-rolls out to Internal testers immediately, no manual "Send for review / Release" click in Play Console. Safe because the Internal track is tester-gated regardless of release status. Previously we had `draft`, which caused every CI build to sit unreleased until someone manually promoted it — testers kept seeing the stale `versionCode=13` manual-upload baseline while new CI versions piled up as drafts.

If you ever need to review before releasing, temporarily flip back to `"draft"`, run the deploy, promote via Play Console UI, and flip back.

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

**iOS path (wired 2026-04-18, blocked 2026-04-19):**

Status: the workflow is fully wired and credentials (ASC API team key) are in the vault. The **first-run signing bootstrap is still pending** — EAS cannot create a Distribution Certificate + store provisioning profile from a `--non-interactive` CI runner, so a one-time local `eas build --platform ios --profile production --local` must be run on a maintainer's Mac first to populate EAS's server-side credentials. After that run, CI dispatches will succeed. Until then, `profile=ios` workflows fail at the build step with *"Distribution Certificate is not validated for non-interactive builds"*.

Select `profile=ios` on the workflow dispatch; the job runs on `macos-latest`, builds an IPA via EAS, and optionally uploads to TestFlight via EAS Submit using an App Store Connect API team key.

Credentials flow through the same file-vault pattern as Play Store:

- `.env.dev` strings: `APPLE_ID`, `APPLE_TEAM_ID`, `ASC_APP_ID`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID` — all under `##### GitHub Secrets #####`.
- `.env.dev` vault file: `ASC_API_KEY_PATH=infra/dev/vault/asc-api-key.p8` under `##### GitHub Vault Files #####`. `task dev:sync:vault` pushes the `.p8` contents as `ASC_API_KEY_B64`.
- The workflow base64-decodes `ASC_API_KEY_B64` into `apps/mobile/asc-api-key.p8` before `eas submit` runs. `apps/mobile/eas.json`'s iOS submit block references `./asc-api-key.p8` + `ascApiKeyId` + `ascApiIssuerId` (all committed — the key IDs are harmless without the `.p8`).

To rotate: regenerate a Team Key at App Store Connect → Users and Access → **Integrations → App Store Connect API → Team Keys** (role: App Manager). Replace `infra/dev/vault/asc-api-key.p8`, update `ASC_API_KEY_ID` / `ASC_API_ISSUER_ID` in `.env.dev`, run `task dev:sync:vault`. Done.

TestFlight **tester** enrolment is separate (App Store Connect → My Apps → ReviewApp → TestFlight → Internal Testing). The API key doesn't manage testers — only builds.

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
