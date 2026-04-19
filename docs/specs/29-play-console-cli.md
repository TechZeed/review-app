# Spec 29 — Play Console CLI & Release Debugging

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Implemented (CLI shipped; follow-ups listed in §9)
**Related:** Spec 17 (GitHub workflows — mobile pipeline), Spec 22 (file vault pattern — SA key lives here).

---

## 1. Problem

`deploy-mobile.yml` submits AABs to Play Internal via EAS Submit, but we had **no programmatic visibility** into what actually landed on Play afterwards. Every status check meant opening `play.google.com/console` and clicking through app → release → track → detail. Symptoms this caused:

- Couldn't tell from the terminal whether a `deploy-mobile` run's submit step had resulted in a visible release.
- Couldn't answer "what's the current versionCode in Internal?" without opening a browser.
- Store-listing gaps (missing short/full description, contact details) that block promotion to external testing weren't surfaced anywhere in our tooling — only Play's web UI would flag them, and only if you navigated to the right page.
- Debugging submit failures required cross-referencing EAS submission ID against Play Console manually.

## 2. Goals

- A one-command view of Play Console state for `sg.reviewapp.app`: identity, listing completeness, releases on every track.
- Zero interactive auth. Reuses the existing Play Developer API credentials (the `eas-submit@humini-review.iam.gserviceaccount.com` service account granted Release Manager via Play Console → Users and permissions / Settings → Developer account → API access).
- Scoped output: `--track=internal` to focus on one track; `--package=<id>` to point at a future second app if we ever have one.
- Minimal surface area — no writes. Read-only diagnostic.

## 3. Non-goals (this spec)

- No release promotion (promote internal → beta → production is a Play Console action with its own approval workflow; scripting it is Spec 29.1 follow-up).
- No release-notes editing, listing metadata upload, screenshots upload. Those are `eas metadata` / fastlane territory — deferred to spec 31.
- No changes to `deploy-mobile.yml` or the submit pipeline itself — those are Spec 17's scope.

## 4. Implementation

### 4.1 Script
`infra/scripts/play-status.ts` (bun). Single file, no new npm deps. Uses:

- `node:crypto` for RS256 JWT signing.
- `fetch()` for token exchange + REST calls.
- `readFileSync(infra/dev/vault/eas-submit-sa.json)` to get SA credentials.

### 4.2 Auth flow

1. Load SA JSON from the vault (`infra/dev/vault/eas-submit-sa.json`, same file `deploy-mobile.yml` decodes for `eas submit`).
2. Build a JWT claim set: `{iss: client_email, scope: "https://www.googleapis.com/auth/androidpublisher", aud: token_uri, exp: now+3600, iat: now}`.
3. RS256-sign with the SA private key.
4. POST to `sa.token_uri` (Google OAuth2 token endpoint), grant type `urn:ietf:params:oauth:grant-type:jwt-bearer`, assertion = the signed JWT.
5. Response has `access_token`. Use it as `Authorization: Bearer <token>` against `androidpublisher.googleapis.com`.

No `google-auth-library` dependency — Node's crypto primitives + `fetch` are enough. Script is ~200 lines total.

### 4.3 API surface queried

All via Google Play Developer API v3, under `/androidpublisher/v3/applications/<package>`:

1. `POST /edits` → creates a short-lived edit session, returns `{id}`. Read-only queries still need one.
2. `GET /edits/:editId/details` → `{defaultLanguage, contactEmail, contactWebsite}`.
3. `GET /edits/:editId/listings` → array of `{language, title, shortDescription, fullDescription}`.
4. `GET /edits/:editId/tracks` → array of `{track, releases: [{name, versionCodes, status, userFraction, releaseNotes}]}`.
5. `DELETE /edits/:editId` → dispose. Never commit — we only read.

### 4.4 Output shape

Human-readable plain text to stdout, three sections with dividers:

```
━━━ app details ━━━
default language: en-GB
contact email:    (unset)
contact website:  (unset)

━━━ store listings ━━━
[en-GB]
  title:             ReviewApp
  short description: (empty)
  full description:  (empty)

━━━ tracks & releases ━━━

◎ production  (0 releases)
   — no releases on this track

◎ internal  (2 releases)
   draft      versionCode=[115]  name='1.0.0'
   completed  versionCode=[13]   name='13 (1.0.0)'
```

Designed for quick visual scan, not parsing. If we need JSON, add a `--json` flag later.

### 4.5 Task wrapper

```yaml
# Taskfile.dev.yml
play:status:
  desc: Query Play Console (via eas-submit SA) for app identity, listings, and track releases
  cmd: bun run {{.REPO_ROOT}}/infra/scripts/play-status.ts {{.CLI_ARGS}}
```

Invocations:

```bash
task dev:play:status                            # all tracks, all sections
task dev:play:status -- --track=internal        # filter to internal
task dev:play:status -- --package=sg.other.app  # different app in same GCP project
```

## 5. Credentials & IAM

The `eas-submit@humini-review.iam.gserviceaccount.com` SA has:

- **Google Cloud Platform side**: none relevant to Play. The GCP project `humini-review` hosts the SA identity but Play API access is granted on the Play side.
- **Play Console side**: via Play Console → Settings → Developer account → API access (not the Users and Permissions page — that's UI-only; the API access page is where service accounts are linked to the developer account). Currently holds Release Manager permissions scoped to `sg.reviewapp.app`.

No additional scopes required for this CLI — `androidpublisher` is the single scope used. The SA's Release Manager role covers: list tracks, list listings, create/read/delete edit sessions.

### 5.1 Required scopes

`https://www.googleapis.com/auth/androidpublisher` — the one scope. Requested in the JWT claim at line 54 of the script. If Google rotates scopes, update there.

### 5.2 Vault linkage (spec 22)

The SA JSON lives at `infra/dev/vault/eas-submit-sa.json`. Vault is gitignored. Bootstrap via `task dev:bundle:pull` (spec 22 §dev-bundle). If the file is missing, `play-status.ts` exits with a clear error pointing at the bootstrap task.

## 6. Regression

Not in the Playwright regression suite. This CLI is a developer/operator tool, not a user-facing feature. Manual verification after changes:

```bash
task dev:play:status | head -10
# expect: authed as eas-submit@... + app details block without errors
```

If the SA loses Play access (rotation, role change), the CLI fails on the token exchange or on the first API call with a clear error. No silent degradation.

## 7. Current state reported (2026-04-19)

Baseline snapshot at implementation time:

| Field | Value |
|---|---|
| Package | `sg.reviewapp.app` |
| Title | `ReviewApp` ✓ |
| Contact email | **(unset)** — blocks external testing |
| Contact website | **(unset)** — blocks external testing |
| Short description | **(empty)** — blocks external testing |
| Full description | **(empty)** — blocks external testing |
| Production track | 0 releases |
| Beta track | 1 draft (versionCode 13) |
| Alpha track | 0 releases |
| Internal track | 2 releases: completed `versionCode=13`, draft `versionCode=115` |

The versionCode 115 draft matches `100 + GITHUB_RUN_NUMBER` from `deploy-mobile.yml` (spec 17 §Android versionCode management). Version 13 was the manual first-upload required by Google policy (spec 17 §Prerequisites).

## 8. Operational use cases

**Smoke after a mobile deploy**:
```bash
gh run watch <id> && task dev:play:status -- --track=internal
```
Confirms the new versionCode actually landed in Internal, not silently failed.

**Before promoting a build**: check that `completed` exists on Internal before clicking Promote to Beta in the Play Console UI.

**Pre-flight listing check**: run before attempting `eas metadata` push (spec 31 future) to see which listing fields are empty.

**Rotation smoke-test**: after rotating the `eas-submit-sa.json` (spec 17 rotation path), `task dev:play:status` is the fastest way to verify the new key still works.

## 9. Follow-ups (not blocking)

- **`--json` output mode** for piping into other scripts.
- **`task dev:play:promote`** — POST a release to a higher track (internal → beta). Requires the edit flow to commit, not just read; and user confirmation guard similar to the `confirm: deploy-mobile` pattern.
- **`task dev:play:listing:push`** — wrap `eas metadata` or equivalent to set title, descriptions, contact email/website, feature graphic from a declarative YAML. Spec 31 territory.
- **Health-check integration** — surface Play listing completeness in `task dev:health` alongside Cloud Run `/health`. Nice-to-have, not load-bearing.

## 10. Invariants

- Read-only. This script never commits an edit, never posts a release, never uploads listing content.
- No dependency beyond bun + node stdlib + fetch. Adding a googleapis npm dep would be a regression — the whole point is zero-install-on-fresh-clone.
- SA key lives in the vault, not env vars. Never inline the key in the script or commit it.
- Package defaults to `sg.reviewapp.app` but every call accepts `--package` so a second app onboarding needs zero code changes.
