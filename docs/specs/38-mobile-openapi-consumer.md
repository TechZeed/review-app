# Spec 38 — `apps/mobile` consumes OpenAPI types + MSW unit test

**Project:** ReviewApp · **Client:** `apps/mobile` · **Date:** 2026-04-20 · **Status:** Draft (dispatch-ready)
**Umbrella:** Spec 37 (OpenAPI pipeline).
**Why first:** this is where the `token` vs `accessToken` runtime bug hit (2026-04-20). Proving the pipeline on mobile locks that class of bug at compile time.

## Scope (minimum viable)

1. Add `openapi-typescript` as a dev-dep.
2. `npm run codegen` script that reads `../../docs/openapi.yaml` → writes `src/api-types.ts`. Commit the generated file.
3. In `apps/mobile/lib/api.ts`, replace the hand-written `ExchangeTokenResponse` + `AuthUser` interfaces with imports from `src/api-types.ts`:
   ```ts
   import type { components } from '../src/api-types';
   export type ExchangeTokenResponse = components['schemas']['ExchangeTokenResponse'];
   export type AuthUser = components['schemas']['AuthUser'];
   ```
   Other interfaces (`Profile`, `Review`, etc.) **may** migrate but aren't required for v1.
4. Install `jest`, `jest-expo`, `@types/jest`, `msw` as dev-deps. Add `jest.config.js` using the `jest-expo` preset.
5. Write **`lib/__tests__/auth.test.ts`** — uses MSW-native to mock `POST /api/v1/auth/login` returning a generated-types-typed payload. Asserts:
   - `signInWithEmailPassword("ramesh@reviewapp.demo", "Demo123")` returns `{ token: "…", user }`.
   - `setToken` was called with a non-empty string.
   - If the mock returns `{ token: "x" }` (old wrong shape), TypeScript rejects the mock at compile time — i.e. the test file literally won't tsc. (Verify by briefly flipping the mock; revert before committing.)
6. `npm run test` passes. `npm run codegen` is idempotent.

## Out of scope

- Full migration of all interfaces (Profile, Review, ReviewsPage). Leave for follow-up PRs.
- Component tests with React Native Testing Library.
- E2E on device (that's spec 35's Maestro path).
- Any apps/api change.

## Acceptance

- `apps/mobile/src/api-types.ts` committed, generated from `docs/openapi.yaml`.
- `ExchangeTokenResponse` + `AuthUser` in `lib/api.ts` imported from it; no local duplicate definition remains.
- `jest.config.js` + `lib/__tests__/auth.test.ts` committed; `npm test` green.
- `npm run codegen` regenerates the types file without diff when the OpenAPI is unchanged.
- The preview APK still builds (trigger `deploy-mobile preview=true submit=false` — optional, not a blocker for merge).

## Files you may touch

- `apps/mobile/package.json` (scripts, devDependencies)
- `apps/mobile/src/api-types.ts` (NEW, generated)
- `apps/mobile/lib/api.ts` (type substitution only — DON'T change runtime logic)
- `apps/mobile/lib/__tests__/auth.test.ts` (NEW)
- `apps/mobile/jest.config.js` (NEW)
- `apps/mobile/jest.setup.ts` (NEW — MSW server lifecycle)

## Rules

- Don't touch `apps/api/`, `apps/ui/`, `apps/web/`, `apps/regression/` — parallel agents own those.
- Don't regenerate `docs/openapi.yaml` (that's an API-side change).
- Conventional commits: `feat(mobile): ...`, `test(mobile): ...`, `chore(mobile): codegen`.
- Rebase on `main` before push; never force-push.
