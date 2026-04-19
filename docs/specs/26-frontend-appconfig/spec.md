# Spec 26 — Frontend AppConfig

## Purpose

Collapse the "N individual `VITE_*` build-args threaded through GitHub
Actions → `deploy.js` → Docker `ARG`/`ENV` → Vite" pattern into a single
build-time argument `APP_ENV=local|dev|prod`. All frontend config
(API URL, Firebase web keys, feature flags) lives in committed per-env
JSON files and is inlined into the bundle at build time by Vite.

Frontend config is not secret — every value ends up in the JS bundle
visible in devtools. Maintaining the same list in 4 places
(`.env.dev`, workflow `env:` block, `VITE_BUILD_ARG_KEYS` in
`deploy.js`, `ARG`/`ENV` lines in each Dockerfile) caused silent drops
(e.g. `VITE_FEATURE_EMAIL_LOGIN` missing on dev, fixed 2026-04-18).

## Packages affected

- `apps/ui` — committed `config/appconfig.{local,dev,prod}.json`,
  typed loader at `src/lib/config.ts`, Vite inlines via `define`.
- `apps/web` — same.
- `infra/scripts/deploy.js` — one `--build-arg APP_ENV=<env>` for
  ui/web builds. All VITE_* handling removed.
- `.github/workflows/deploy.yml` — VITE_* entries stripped, single
  `APP_ENV: dev` added.
- `apps/ui/Dockerfile`, `apps/web/Dockerfile` — single `ARG APP_ENV=prod`.

Out of scope (explicit): `apps/api/**`, `apps/mobile/**`, and
migrating existing `import.meta.env.VITE_*` call sites (see
Follow-up Migration).

## Requirements

### R1 — Per-env committed JSON config

SHALL exist: `apps/ui/config/appconfig.{local,dev,prod}.json` and
`apps/web/config/appconfig.{local,dev,prod}.json`.

MUST match this shape:

```ts
interface AppConfig {
  apiUrl: string;
  publicReviewUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  features: { emailLogin: boolean };
}
```

MUST: `features.emailLogin === true` in local and dev; `false` in prod.
MUST: Firebase values in dev/prod come from `docs/specs/16-auth-strategy.md §2`
(the Firebase project is `humini-review`).

### R2 — Typed loader

SHALL exist: `apps/ui/src/lib/config.ts` and `apps/web/src/lib/config.ts`,
each exporting the `AppConfig` interface and a `config: AppConfig` value
sourced from a `declare const APP_CONFIG: AppConfig` global inlined by Vite.

### R3 — Vite inlining

`apps/ui/vite.config.ts` and `apps/web/vite.config.ts` MUST:

1. Read `process.env.APP_ENV` (default `'local'`).
2. Load `./config/appconfig.${APP_ENV}.json`.
3. Pass it via `define: { APP_CONFIG: JSON.stringify(cfg) }`.
4. Throw a loud `Error` when the file is missing or unparseable.
5. Also inline back-compat `import.meta.env.VITE_*` values derived
   from the same config object, so existing unmigrated call sites
   keep working. These shims are removed once migration (R8) lands.

### R4 — Dockerfile

`apps/ui/Dockerfile` and `apps/web/Dockerfile` MUST declare exactly
one build-arg: `ARG APP_ENV=prod` (with matching `ENV`). All
per-variable `ARG VITE_*` / `ENV VITE_*` lines MUST be removed.

### R5 — deploy.js

`infra/scripts/deploy.js` MUST:

- Not contain `VITE_BUILD_ARG_KEYS`.
- Emit `--build-arg APP_ENV=<env>` (and nothing else) when building
  `ui` or `web`.
- Not include any `VITE_*` keys in `KNOWN_CONFIG_KEYS`.
- Skip any `VITE_*` keys when composing Cloud Run env vars (they
  belong to build-time, not runtime).

### R6 — Workflow

`.github/workflows/deploy.yml` `jobs.deploy.env` MUST NOT list any
`VITE_*` entries. It MUST set `APP_ENV: dev`.

### R7 — Tests

`apps/ui/src/lib/config.test.ts` and `apps/web/src/lib/config.test.ts`
MUST assert:

- Loader exposes the expected shape.
- `dev` config has `features.emailLogin === true` (regression guard).
- `dev` config has non-empty Firebase fields.
- `prod` config has `features.emailLogin === false` (safety).
- `dev.apiUrl !== local.apiUrl`.
- Loader throws for an unknown `APP_ENV`.
- Loader defaults to `local` when `APP_ENV` is unset.

`apps/ui/vitest.config.ts` and `apps/web/vitest.config.ts` MUST apply
the same `define` set used by `vite.config.ts`, so `src/lib/config.ts`
imports succeed under vitest.

### R8 — Follow-up migration

Back-compat `import.meta.env.VITE_*` shims in `vite.config.ts` MUST
be removed once every call site in `apps/{ui,web}/src/` has migrated
to `config.*`. Call sites are listed under _Follow-up Migration_
below. This spec does NOT perform that migration — spec 25 is
concurrently editing many of those files.

## Scenarios

### Scenario: developer runs the UI locally

GIVEN no `APP_ENV` is set
WHEN the developer runs `cd apps/ui && npm run dev`
THEN Vite loads `apps/ui/config/appconfig.local.json`
AND `config.apiUrl === "http://localhost:3000"`
AND `config.features.emailLogin === true`.

### Scenario: CI deploys ui to dev

GIVEN the workflow `env:` sets `APP_ENV: dev`
WHEN `deploy.js ui dev` runs
THEN `docker build --build-arg APP_ENV=dev apps/ui/` is invoked
AND the resulting image contains `apps/ui/config/appconfig.dev.json`
inlined, with `config.apiUrl === "https://review-api.teczeed.com"`
and `config.features.emailLogin === true`.

### Scenario: config file missing

GIVEN `APP_ENV=staging` but `apps/ui/config/appconfig.staging.json`
does not exist
WHEN Vite starts
THEN the build fails loudly with
`[appconfig] not found for APP_ENV=staging: …/config/appconfig.staging.json`.

### Scenario: unmigrated call site still works

GIVEN application code contains `import.meta.env.VITE_API_URL`
AND this spec's migration of that call site has not yet happened
WHEN the bundle is built
THEN the back-compat `define` shim inlines `appConfig.apiUrl`
into the call site, preserving current behavior.

### Scenario: prod bundle has email login disabled

GIVEN `APP_ENV=prod`
WHEN the UI bundle is built
THEN `config.features.emailLogin === false`.

## Follow-up Migration

After spec 25 lands, a small follow-up PR MUST rewrite these call
sites from `import.meta.env.VITE_*` to `config.*` and then delete
the back-compat shims in each `vite.config.ts`.

Call sites at time of writing (grep: `import.meta.env.VITE_`):

- `apps/ui/src/lib/api.ts:1` — `VITE_API_URL` → `config.apiUrl`
- `apps/ui/src/lib/firebase.ts:5–10` — six `VITE_FIREBASE_*` reads → `config.firebase.*`
- `apps/ui/src/pages/LoginPage.tsx:6` — `VITE_FEATURE_EMAIL_LOGIN` → `config.features.emailLogin`
- `apps/ui/src/components/ProfileCard.tsx:13` — `VITE_PUBLIC_REVIEW_URL` → `config.publicReviewUrl`
- `apps/web/src/pages/ReviewPage.tsx:9` — `VITE_API_URL` → `config.apiUrl`
- `apps/web/src/components/OtpInput.tsx:9` — `VITE_API_URL` → `config.apiUrl`
- `apps/web/src/components/MediaPrompt.tsx:8` — `VITE_API_URL` → `config.apiUrl`

Once migration lands, delete the `import.meta.env.VITE_*` entries
from `buildDefines()` in `apps/ui/config/load.ts` and
`apps/web/config/load.ts`.
