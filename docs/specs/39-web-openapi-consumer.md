# Spec 39 — `apps/web` consumes OpenAPI types + MSW unit test

**Project:** ReviewApp · **Client:** `apps/web` (customer scanner flow at `review-scan.teczeed.com`) · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 37.

## Scope (minimum viable)

1. `openapi-typescript` dev-dep + `npm run codegen` script → `src/api-types.ts` from `../../docs/openapi.yaml`. Commit.
2. Replace hand-written request/response types in `apps/web/src/` with imports from `api-types.ts`. Focus on:
   - `ScanResponse` (from `POST /reviews/scan/:slug`)
   - Any shape used in `ReviewPage.tsx` or `OtpInput.tsx` that maps to an API response
3. Jest + MSW setup (`jest` + `@testing-library/jest-dom` + `msw` + `jest-environment-jsdom`). Add `jest.config.ts` pointing at `ts-jest` or `@swc/jest` (match whichever the repo already uses for Vite apps — check `apps/ui` for precedent).
4. One smoke unit test — `src/__tests__/scan.test.ts`:
   - Mocks `POST /api/v1/reviews/scan/ramesh-kumar` with a generated-types-typed `ScanResponse` payload.
   - Calls the fetch wrapper (or hooks the component's API call) and asserts the `reviewToken` + `profile` fields come through correctly.

## Out of scope

- Full-page React component tests.
- Media upload flow tests (spec 33 is fixing that API side).
- Any `apps/api/` change.
- `apps/web/src/pages/PrivacyPage.tsx` — static content, no API.

## Acceptance

- `apps/web/src/api-types.ts` committed.
- At least `ScanResponse` imported from it.
- Jest smoke test green.
- `npm run codegen` idempotent.
- Vite build still succeeds (`npm run build` in `apps/web`).

## Files you may touch

- `apps/web/package.json`
- `apps/web/src/api-types.ts` (NEW)
- `apps/web/src/*.ts` / `.tsx` — only for type substitution, no logic change
- `apps/web/src/__tests__/scan.test.ts` (NEW)
- `apps/web/jest.config.ts`, `apps/web/jest.setup.ts` (NEW)

## Rules

- Don't touch other client apps (mobile/ui/regression) or the API.
- Don't regenerate `docs/openapi.yaml`.
- Conventional commits.
- Rebase on `main` before push.
