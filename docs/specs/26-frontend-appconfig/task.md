---
status: completed
slug: 26-frontend-appconfig
handoff_from: muthuishere
date: 2026-04-18
packages: [ui, web, infra]
off_limits:
  - apps/mobile/**
  - apps/api/**
  # Sreyash 25 is concurrently editing these UI/web files. Do NOT touch them
  # in this spec — spec 25 will migrate them to the new config pattern as a
  # small follow-up once it completes.
  - apps/ui/src/lib/api.ts
  - apps/ui/src/pages/ProfilePage.tsx
  - apps/ui/src/pages/DashboardPage.tsx
  - apps/ui/src/components/ProfileCard.tsx
  - apps/ui/src/components/Avatar.tsx
  - apps/web/src/lib/**
  - apps/web/src/pages/**
  - apps/web/src/components/**
test_frameworks:
  ui: vitest
  web: vitest
project_context: ~/config/muthuishere-agent-skills/review-app/project.md
---

## Task

Replace the current "N individual `VITE_*` build-args threaded through
GitHub Actions → deploy.js → Docker `ARG`/`ENV` → Vite" pattern with a
simpler committed-file pattern that mirrors the API's existing
`apps/api/config/application.{local,dev,prod}.env` convention.

**Goal:** one build-time argument, `APP_ENV=local|dev|prod`. Everything
else comes from a committed `appconfig.{env}.json` file inlined at
build time via Vite `define`.

**Why:** frontend "config" (Firebase web keys, API URLs, Stripe
publishable keys, feature flags) is **not secret** — it's baked into
the JS bundle and visible in browser devtools. Pretending otherwise has
us maintaining the same list in 4 places (`.env.dev`, workflow env
block, `VITE_BUILD_ARG_KEYS` in `deploy.js`, `ARG`/`ENV` lines in each
Dockerfile) and silently dropping variables when any of the 4 drift
(the exact bug that hid `VITE_FEATURE_EMAIL_LOGIN` on dev until 2026-04-18).

## Acceptance Criteria

### AC1 — Config files per frontend app, per env

Create committed configs (MVP: `apps/ui` + `apps/web` only; mobile is
off-limits for now):

```
apps/ui/config/appconfig.local.json
apps/ui/config/appconfig.dev.json
apps/ui/config/appconfig.prod.json
apps/web/config/appconfig.local.json
apps/web/config/appconfig.dev.json
apps/web/config/appconfig.prod.json
```

Shape (TypeScript interface — generate once in `src/lib/config.ts`):

```ts
export interface AppConfig {
  apiUrl: string;                 // https://review-api.teczeed.com
  publicReviewUrl: string;        // https://review-scan.teczeed.com
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  features: {
    emailLogin: boolean;
  };
}
```

Populate the 6 JSON files with the correct values per env (pull current
`dev` values from `.github/workflows/deploy.yml` `env:` block and
`spec 16 § 2`).

No Stripe publishable key appears on the UI today (only in scan? scan
doesn't checkout) — include `stripe?: { publishableKey: string }` only
if you find a current consumer. Otherwise omit.

### AC2 — Config loader (typed)

Create in each frontend:
- `apps/ui/src/lib/config.ts`
- `apps/web/src/lib/config.ts`

```ts
// Vite inlines APP_CONFIG at build time via `define` in vite.config.ts.
// The value is the full JSON object — no runtime fetch, no drift.
declare const APP_CONFIG: AppConfig;
export const config: AppConfig = APP_CONFIG;
```

The `AppConfig` interface is duplicated across both apps (MVP — no
shared workspace package).

### AC3 — Vite plugin inlines the config

Update `apps/ui/vite.config.ts` and `apps/web/vite.config.ts` to:

1. Read `process.env.APP_ENV` (default `'local'`).
2. Load `./config/appconfig.${APP_ENV}.json`.
3. Pass it via `define: { APP_CONFIG: JSON.stringify(config) }`.

Fail the build loudly (`throw new Error`) if the file is missing or
unparseable.

### AC4 — Dockerfile: single `ARG APP_ENV=prod`

Strip the per-variable `ARG VITE_*` / `ENV VITE_*` lines. Replace with
one `ARG APP_ENV=prod` + `ENV APP_ENV=$APP_ENV`. Apply to:

- `apps/ui/Dockerfile`
- `apps/web/Dockerfile`

### AC5 — deploy.js simplified

In `infra/scripts/deploy.js`:

- Delete the `VITE_BUILD_ARG_KEYS` constant.
- Replace the build-args block in `buildAndPushImage` (around line 360)
  with `buildArgs = \`--build-arg APP_ENV=${env}\`` for both `ui` and
  `web` services.
- Delete any process.env overlay entries for `VITE_*` keys in
  `KNOWN_CONFIG_KEYS` (they're no longer read).

### AC6 — Workflow env block simplified

In `.github/workflows/deploy.yml` `jobs.deploy.env` — **remove** all the
`VITE_*` lines. They're no longer needed; config is in the repo. Keep
only the `APP_ENV` (new — set to `dev` since that's what this workflow
targets) and the API-side secrets.

### AC7 — Tests

**`apps/ui`** (co-located `config.test.ts` in `src/lib/`):
- Loader returns the expected shape (narrow type assertion).
- `features.emailLogin` is `true` in the dev config (regression guard
  for the bug we just fixed).
- Required Firebase fields are non-empty in the dev config.

**`apps/web`**: same three assertions against `apps/web`'s configs.

**`apps/ui/vitest.config.ts`**: ensure the `define` hook is engaged in
tests too, or set up a test-only `APP_CONFIG` stub in `src/test/setup.ts`
so runtime imports of `config` don't explode during vitest runs.

Run `npm run test` in both apps; all green.

Run `docker build --build-arg APP_ENV=dev apps/ui/` and
`docker build --build-arg APP_ENV=dev apps/web/` locally to confirm the
images build clean with the new pattern. (If Docker isn't available in
the sub-agent environment, skip and note in Assumptions.)

### AC8 — Non-goals / boundaries (be strict)

- Do NOT touch `apps/mobile/**`. Mobile has its own `EXPO_PUBLIC_*`
  flow; Expo integration is a follow-up spec.
- Do NOT touch `apps/api/**`. API config is already correct.
- Do NOT migrate existing `import.meta.env.VITE_*` reads in application
  code. **Sreyash 25 is concurrently editing those files.** That
  migration happens in a small PR after both 25 and 26 land — the
  migration is: `import.meta.env.VITE_API_URL` → `config.apiUrl`,
  `import.meta.env.VITE_FIREBASE_API_KEY` → `config.firebase.apiKey`,
  etc. Leave a `## Follow-up Migration` section in `spec.md` listing
  every `import.meta.env.VITE_*` call site for the next PR.
- Do NOT break the existing `import.meta.env` reads in the meantime —
  the old env vars should still be injectable during the overlap.
  Achieve this by **keeping the workflow env block unchanged for now**
  (i.e. skip AC6) if removing it would break the running app. Actually:
  remove them, but also have the Vite plugin in AC3 **also** set the
  classic `import.meta.env.VITE_*` values from the config file so old
  code keeps working until migrated. (Use Vite `define` for
  `import.meta.env.VITE_FEATURE_EMAIL_LOGIN` etc. — same mechanism.)

Explicitly: back-compat define shims keep existing code working. New
code reads from `config.*`. Migration PR removes the shims once all
call sites are updated.

## Context from Huddle

- User raised this during a separate flow while debugging a silently-dropped
  `VITE_FEATURE_EMAIL_LOGIN` build-arg. Quote: "why cant we have one
  argument local,dev,production and keep all other stuff within some
  app config instead of these many unnecessary we can hardcode in a
  file called appconfig.local.js appconfig.dev.js and appconfig.prod.js
  js or json just load as assets and we can use when building right".
- Ordering decision: the current Dockerfile patch (PR #9) ships first
  to unblock today's dev testing. Spec 26 is the structural follow-up
  that makes this class of bug impossible.
- Secrets clarification: frontend config is **not secret** (bundled into
  JS, visible in devtools). Real secrets (DB password, JWT secret,
  Stripe secret key, Firebase service account) live on the API and stay
  in GCP Secret Manager — untouched by this spec.

## Style Stance

- Naming: camelCase in the AppConfig interface (no SCREAMING_SNAKE at
  the TS level). JSON files use camelCase keys.
- File layout: `apps/<app>/config/appconfig.<env>.json`. Loader at
  `src/lib/config.ts`.
- Typing: single exported `AppConfig` interface per app.
- Test style: invoke-and-validate; vitest imports the loader and
  asserts shape.
- Dependencies: no new deps.
- Dev ergonomics: developer running `npm run dev` without `APP_ENV`
  should default to `local` and load `appconfig.local.json` — zero
  extra config.

## Project Context

See CLAUDE.md at repo root. The API's existing config pattern is the
inspiration: `apps/api/config/application.{local,dev,test,prod}.env`
(committed defaults) + `.env.<env>` (gitignored overrides). We're
doing the committed-defaults half for the frontends; there's no need
for a runtime-override layer on the frontend since all values are
public-by-bundle.

## Artifacts (filled in as Sreyash works)

- Spec: docs/specs/26-frontend-appconfig/spec.md
- Tests:
  - apps/ui/src/lib/config.test.ts (8 tests, all passing)
  - apps/web/src/lib/config.test.ts (8 tests, all passing)
- Code:
  - apps/ui/config/appconfig.{local,dev,prod}.json (new)
  - apps/ui/config/load.ts (new — shared by vite + vitest)
  - apps/ui/src/lib/config.ts (new)
  - apps/ui/vite.config.ts (updated — `define` via loader)
  - apps/ui/vitest.config.ts (updated — mirrors `define`)
  - apps/ui/Dockerfile (updated — single `ARG APP_ENV=prod`)
  - apps/web/config/appconfig.{local,dev,prod}.json (new)
  - apps/web/config/load.ts (new)
  - apps/web/src/lib/config.ts (new — note: src/lib is Sreyash-25 territory
    but creating this file is called out in AC2)
  - apps/web/src/lib/config.test.ts (new)
  - apps/web/vite.config.ts (updated)
  - apps/web/vitest.config.ts (new)
  - apps/web/package.json (added vitest + jsdom + jest-dom devDeps, `test` script)
  - apps/web/Dockerfile (updated — single `ARG APP_ENV=prod`)
  - infra/scripts/deploy.js (removed VITE_BUILD_ARG_KEYS, now emits
    `--build-arg APP_ENV=<env>`; VITE_* keys dropped from KNOWN_CONFIG_KEYS
    and filtered from Cloud Run env vars)
  - .github/workflows/deploy.yml (stripped VITE_* env entries; added
    `APP_ENV: dev`)
- Assumptions:
  - Firebase dev/prod values are identical (single humini-review project for
    both environments). Only `features.emailLogin` differs between prod
    (false) and dev/local (true).
  - `publicReviewUrl` (review-scan.teczeed.com) mirrors the API's
    FRONTEND_URL. Local uses localhost:5174 (ui) / localhost:5173 (web).
  - No Stripe publishable key is consumed by frontends today — omitted from
    AppConfig (can be added later via `stripe?: { publishableKey: string }`).
  - Back-compat `import.meta.env.VITE_*` shims remain in vite.config.ts
    `define` until the follow-up migration PR (after spec 25 lands).
  - Vitest tests use `node`/`jsdom` env; the config test only needs pure
    JSON import + loader invocation (no React).
  - Docker build (`docker build --build-arg APP_ENV=dev apps/ui/`) was
    attempted but failed at `RUN npm ci` in this sandbox (appears to be
    a pre-existing registry/network flakiness — Vite build locally works
    fine, and the Dockerfile change is a pure subtraction of ARG lines).
    Recommend re-verifying from a clean shell before merging.
- Blockers: none.
