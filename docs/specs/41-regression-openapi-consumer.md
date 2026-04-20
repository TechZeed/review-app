# Spec 41 — `apps/regression` consumes OpenAPI types

**Project:** ReviewApp · **Client:** `apps/regression` (Playwright E2E suite) · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 37.
**Note:** Smallest of the four consumer specs — the suite already runs; this is a type-tightening pass so the regression spec files themselves benefit from compile-time drift detection.

## Scope (minimum viable)

1. `openapi-typescript` dev-dep + `npm run codegen` → `src/api-types.ts` from `../../docs/openapi.yaml`. Commit.
2. Replace the hand-written API types in `apps/regression/src/lib/`:
   - `src/lib/auth.ts` — `LoginResult` should be `components['schemas']['ExchangeTokenResponse']`
   - `src/lib/adminApi.ts` — any `user` / `capability` shape in the admin helpers
3. Keep Playwright's own `request` context — don't swap to fetch. No MSW here (regression hits the real API).
4. No new test file — existing specs are proof the types work end-to-end.

## Out of scope

- MSW mocks (regression is integration-level — uses real API).
- Changing Playwright config / projects.
- Changing any flow spec file's assertions.
- Any API or other client change.

## Acceptance

- `apps/regression/src/api-types.ts` committed.
- `src/lib/auth.ts` and `src/lib/adminApi.ts` import generated types.
- `task dev:test:regression` runs green locally (or in CI) after the change.
- `npm run codegen` in `apps/regression/` is idempotent.

## Files you may touch

- `apps/regression/package.json`
- `apps/regression/src/api-types.ts` (NEW)
- `apps/regression/src/lib/auth.ts`, `apps/regression/src/lib/adminApi.ts`, `apps/regression/src/lib/api.ts` — type substitution only

## Rules

- Don't touch `src/flows/*` — regression flow files are owned by their existing specs (spec 25 etc.).
- Don't touch other client apps or the API.
- Don't regenerate `docs/openapi.yaml`.
- Conventional commits: `test(regression):`, `chore(regression): codegen`.
- Rebase on `main` before push.
