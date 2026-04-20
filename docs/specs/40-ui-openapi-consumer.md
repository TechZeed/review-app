# Spec 40 — `apps/ui` consumes OpenAPI types + MSW unit tests

**Project:** ReviewApp · **Client:** `apps/ui` (signed-in dashboard at `review-dashboard.teczeed.com`) · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 37.

## Scope (minimum viable)

1. `openapi-typescript` dev-dep + `npm run codegen` → `src/api-types.ts`. Commit generated file.
2. Replace hand-written interfaces in `apps/ui/src/lib/` and `apps/ui/src/pages/` with generated types. Start with the high-value ones:
   - `ExchangeTokenResponse` + `AuthUser` (in `lib/auth-service.ts` and `App.tsx`'s `AuthUser` — where the same bug class could hit)
   - `SubscriptionMe` + `Capability` (in `BillingPage.tsx`, `LoginPage.tsx` — the one that fetches capabilities on login)
3. Jest + MSW setup (match any existing Vitest / Jest infra in `apps/ui` — check `vitest.config.ts` if present; otherwise add `jest.config.ts` + `@testing-library/react` + `msw`).
4. One smoke unit test — `src/__tests__/login.test.tsx`:
   - Renders `LoginPage` in JSDOM.
   - MSW mocks `POST /api/v1/auth/login` returning a generated-types-typed `ExchangeTokenResponse` + `GET /api/v1/subscriptions/me` returning `SubscriptionMe`.
   - Fills email+password, submits, asserts the AuthContext.user has the expected role + capabilities.

## Out of scope

- Component tests for every page (Dashboard, Admin, Employer, Recruiter, Profile).
- Full E2E (regression suite already covers that).
- Any `apps/api/` change.
- Changing AuthUser to add `capabilities` — that's already in `App.tsx` from spec 28.

## Acceptance

- `apps/ui/src/api-types.ts` committed.
- `ExchangeTokenResponse`, `AuthUser`, `SubscriptionMe`, `Capability` imported from generated types; no local duplicates.
- Jest / Vitest smoke test green.
- `npm run codegen` idempotent.
- Vite build still succeeds; regression suite still green after UI deploy.
- UI deployed: `gh workflow run deploy.yml -f service=ui -f confirm=deploy` — wait for green before merging.

## Files you may touch

- `apps/ui/package.json`
- `apps/ui/src/api-types.ts` (NEW)
- `apps/ui/src/App.tsx`, `apps/ui/src/lib/auth-service.ts`, `apps/ui/src/pages/LoginPage.tsx`, `apps/ui/src/pages/BillingPage.tsx` — **type substitution only**
- `apps/ui/src/__tests__/login.test.tsx` (NEW)
- `apps/ui/jest.config.ts` / `vitest.config.ts` + setup (NEW if absent)

## Rules

- Don't touch other client apps or the API.
- Don't regenerate `docs/openapi.yaml`.
- Preserve regression testids that already exist on LoginPage, BillingPage, etc.
- Conventional commits.
- Rebase on `main` before push.
