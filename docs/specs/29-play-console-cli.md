# Spec 29 — Play Console CLI Tooling

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19 (split 2026-04-19 — listing-content carved out to spec 30)
**Status:** Implemented
**Related:** Spec 17 (GitHub workflows — mobile pipeline), Spec 22 (file vault pattern), **Spec 30** (store listing content as code).

---

## 1. Problem

`deploy-mobile.yml` submits AABs to Play Internal via EAS Submit, but we had **no programmatic visibility** into what actually landed on Play afterwards, and no way to manage the listing itself from source control. Every status check meant opening `play.google.com/console`; every listing change meant clicking through a web UI; every screenshot regeneration was manual.

This spec covers the **tooling** side: the CLIs that talk to Google Play Developer API. Spec 30 covers the **content** side (listing YAML, assets, PRD-sourced copy, the screenshot source URLs).

## 2. Goals

- One-command read: app identity, listings, tracks, releases, image counts.
- One-command write: push listing text + images from committed source.
- Zero interactive auth. Reuses the `eas-submit@humini-review.iam.gserviceaccount.com` service account (Play Console → Settings → Developer account → API access, role Release Manager).
- Zero new npm deps. Bun + `node:crypto` + `fetch` + optional use of the existing `apps/regression/node_modules/@playwright/test` for screenshots.

## 3. Non-goals (this spec)

- No release **promotion** (internal → beta → production). Follow-up.
- No release-notes editing, localization, app-content policy toggles (content rating, target audience). Follow-up.
- No fastlane, no Ruby, no `eas metadata` (iOS-only today; doesn't push Play).
- No changes to `deploy-mobile.yml` — that's Spec 17.
- Listing content itself — in Spec 30.

## 4. Scripts

All under `infra/scripts/`, all bun-runnable, all read `infra/dev/vault/eas-submit-sa.json` (spec 22 vault).

### 4.1 `play-auth.ts` — shared auth helper

Exports:

- `loadServiceAccount()` → parses the SA JSON, throws a clear `task dev:bundle:pull` hint if the vault file is missing.
- `getAccessToken(sa)` → builds JWT (RS256 via `node:crypto`), POSTs to `sa.token_uri` with `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer`, returns `access_token`.
- `DEFAULT_PACKAGE = "sg.reviewapp.app"`.
- `withEdit(token, pkg, fn)` — create edit → run `fn(editId)` → best-effort DELETE on finally.
- `stripCompletedReleasesFromAllTracks(token, pkg, editId)` — the draft-app workaround (§4.6 below).

Single import surface so the three caller scripts stay small. `node:crypto` is enough — no `google-auth-library`, no `googleapis`.

### 4.2 `play-status.ts` — read-only diagnostic

```
task dev:play:status                            # everything
task dev:play:status -- --track=internal        # filter
task dev:play:status -- --package=sg.other.app  # different app
```

Output (plain text, dividers, scannable):

```
━━━ app details ━━━
default language: en-GB
contact email:    elan@arusinnovation.com
contact website:  https://teczeed.com

━━━ store listings ━━━
[en-GB]
  title:             ReviewApp
  short description: Every individual is a brand. Your reviews, portable for life.
  full description:  1887 chars

━━━ listing images (en-GB) ━━━
  ✓ icon               1 image
  ✓ featureGraphic     1 image
  ✓ phoneScreenshots   3 images

━━━ tracks & releases ━━━

◎ internal  (2 releases)
   draft      versionCode=[115]  name='1.0.0'
   completed  versionCode=[13]   name='13 (1.0.0)'
```

The `✓` / `⚠️` markers on image rows flag whether the category has ≥1 (icon, featureGraphic) or ≥2 (phoneScreenshots — Play's minimum for promotion).

### 4.3 `play-listing-push.ts` — text + contact

Pushes `apps/mobile/store-listing.yml` (see Spec 30):

1. Create edit.
2. `PATCH /details` — `defaultLanguage`, `contactEmail`, `contactWebsite`.
3. `PUT /listings/{language}` — `title`, `shortDescription`, `fullDescription`.
4. Strip completed releases from edit-view tracks (§4.6).
5. Commit.
6. Try/finally DELETEs the edit on any error. Idempotent — running twice in a row is a no-op on the second pass if nothing changed.

### 4.4 `play-images-push.ts` — icon, feature graphic, screenshots

Uploads from `apps/mobile/store-assets/` (see Spec 30):

1. Create edit.
2. Upload via `POST /upload/androidpublisher/v3/applications/{pkg}/edits/{editId}/listings/{lang}/{imageType}?uploadType=media` — binary body, content-type `image/png`.
3. Icon + feature graphic: upload replaces the single slot.
4. Phone screenshots: `DELETE /listings/{lang}/phoneScreenshots` first, then `POST` each in order (2, 3, or more).
5. Strip completed releases (§4.6).
6. Commit. Try/finally DELETE on error. Idempotent.

### 4.5 `capture-store-screenshots.ts` — asset generator

Sources for Spec 30's `apps/mobile/store-assets/`:

- **Icon**: `magick convert apps/mobile/assets/icon.png -resize 512x512 apps/mobile/store-assets/icon-512.png`.
- **Feature graphic**: ImageMagick generates an indigo `#4f46e5` 1024×500 canvas + centered "ReviewApp" wordmark + tagline. Placeholder; replace with designer output by swapping the PNG in place (no code change).
- **Phone screenshots**: Playwright (imported from `apps/regression/node_modules/@playwright/test`) opens Chromium at 1080×1920, navigates to each source URL (Spec 30 §3), full-page screenshot. Dashboard captures prime localStorage `auth_user` first (seeded via `loginAs(ramesh@reviewapp.demo)`) same way the regression suite does.

Re-runnable on demand: `task dev:play:assets:regenerate` overwrites everything in `apps/mobile/store-assets/`.

### 4.6 Draft-app commit workaround

Before the app has its first production-reviewed release, Play rejects any edit commit that contains a non-draft release in any track snapshot with:

```
400 Only releases with status draft may be created on draft app.
```

The `changesNotSentForReview` query param doesn't help (`false` → same 400; `true` → "must not be set").

**Workaround** (in `play-auth.ts`'s `stripCompletedReleasesFromAllTracks`): before commit, for every track currently in the edit, PUT the track keeping only `status === "draft"` releases. Play preserves completed releases independently — `play-status` still shows them after commit. This unblocks listing/details/image commits without affecting live state.

Becomes a no-op once the app has a production-reviewed release.

## 5. Task wiring

`Taskfile.dev.yml` → Play Console section:

```yaml
play:status:              cmd: bun run .../play-status.ts {{.CLI_ARGS}}
play:listing:push:        cmd: bun run .../play-listing-push.ts {{.CLI_ARGS}}
play:images:push:         cmd: bun run .../play-images-push.ts {{.CLI_ARGS}}
play:assets:regenerate:   cmd: bun run .../capture-store-screenshots.ts {{.CLI_ARGS}}
```

Standard ops sequence to rebuild-and-publish a full listing: `assets:regenerate → listing:push → images:push → status`.

## 6. Credentials & IAM

- SA: `eas-submit@humini-review.iam.gserviceaccount.com` (JSON at `infra/dev/vault/eas-submit-sa.json`).
- Scope: `https://www.googleapis.com/auth/androidpublisher` (one scope, requested in the JWT claim).
- Play role: **Release Manager** on `sg.reviewapp.app`, granted via Play Console → Settings → Developer account → API access (NOT Users and Permissions — that page is UI-only).
- Rotation: drop a new SA JSON into the vault, `task dev:bundle:push`. Smoke-test with `task dev:play:status`.

## 7. Regression

Not in the Playwright suite. Operator tool. Smoke-test manually after changes:

```bash
task dev:play:status | head -10
# expect: authed as eas-submit@... + app details block, no errors
```

Write-path round-trip:

```bash
task dev:play:assets:regenerate
task dev:play:listing:push
task dev:play:images:push
task dev:play:status
# expect: every text field set, ≥1 icon, ≥1 featureGraphic, ≥2 phoneScreenshots
```

## 8. Follow-ups (not blocking)

- **`--json` output mode** for `play-status.ts` for piping.
- **`task dev:play:promote`** — POST a release to a higher track (internal → closed → production). Requires edit commit + a `confirm=promote` guardrail like `deploy-mobile`.
- **App-content push** — content rating, target audience, data safety form. Currently manual in Play Console → Policy → App content. Worth automating once those fields stabilize.
- **Health-check integration** — surface Play listing completeness in `task dev:health` alongside Cloud Run `/health`.
- **Prod mirror** — replicate under a `prod:` Taskfile label once there's a second Play developer account in scope.

## 9. Invariants

- SA key lives in the vault, never env, never committed.
- Zero new npm deps — bun + node stdlib + fetch + existing Playwright via apps/regression.
- Every script defaults to `sg.reviewapp.app` but accepts `--package=<id>`. Second app onboarding is zero code change.
- Write CLIs are idempotent — re-running is safe. Every edit session is wrapped in try/finally that DELETEs on any error path.
- Listing **content** (copy, assets) lives in Spec 30's files. This spec's scripts are dumb pipes — they execute what Spec 30 declares.
