# Spec 49 — `/profiles/me*` must work for EMPLOYER and RECRUITER, not just INDIVIDUAL

**Owner:** Sreyash · **Date:** 2026-04-20 · **Status:** Draft
**Severity:** Blocker on dev — every non-INDIVIDUAL user sees a red error on `/dashboard`.
**Related:** Spec 16 (auth), Spec 28 (capabilities), Spec 26 (profile edit UI).

## Problem (live bug on dev)

Logged in as `james@reviewapp.demo` (EMPLOYER) or `rachel@reviewapp.demo` (RECRUITER), opening `https://review-dashboard.teczeed.com/dashboard` shows:

```
Failed to load profile. Make sure the API server is running.
API error 403: {"error":"Insufficient permissions","code":"FORBIDDEN"}
```

The nav still shows the **Dashboard** link for these roles (per spec 28's capability table), so users *expect* it to work. The only role that doesn't 403 is INDIVIDUAL.

## Root cause

Every `/profiles/me*` route in `apps/api/src/modules/profile/profile.routes.ts` is gated with `requireRole(['INDIVIDUAL'])`:

```ts
profileRouter.get('/me',          authenticate, requireRole(['INDIVIDUAL']), controller.getOwn);
profileRouter.put('/me',          authenticate, requireRole(['INDIVIDUAL']), …, controller.update);
profileRouter.patch('/me/visibility', authenticate, requireRole(['INDIVIDUAL']), …, controller.updateVisibility);
profileRouter.get('/me/qr',       authenticate, requireRole(['INDIVIDUAL']), …, controller.getQrCode);
profileRouter.get('/me/stats',    authenticate, requireRole(['INDIVIDUAL']), …, controller.getStats);
```

A profile is owned by *the user*, not by their role. Every authenticated user has one (auto-created on signup) and every role's dashboard reads from it.

## Fix

Drop the role gate on every `/profiles/me*` route. Keep `authenticate`. Don't touch `POST /profiles` (creation is still INDIVIDUAL-only because EMPLOYER/RECRUITER profiles are seeded by a different path).

```ts
// Before
profileRouter.get('/me', authenticate, requireRole(['INDIVIDUAL']), controller.getOwn);
// After
profileRouter.get('/me', authenticate, controller.getOwn);
```

Apply to all five `/me*` routes (`get /me`, `put /me`, `patch /me/visibility`, `get /me/qr`, `get /me/stats`).

## GIVEN / WHEN / THEN

- **GIVEN** an authenticated EMPLOYER **WHEN** they `GET /api/v1/profiles/me` **THEN** the API returns 200 with their profile (not 403).
- **GIVEN** an authenticated RECRUITER **WHEN** they `GET /api/v1/profiles/me` **THEN** the API returns 200 with their profile.
- **GIVEN** an authenticated ADMIN **WHEN** they `GET /api/v1/profiles/me` **THEN** the API returns 200 (admin already worked because of the bypass; keep it green).
- **GIVEN** an authenticated INDIVIDUAL **WHEN** they `GET /api/v1/profiles/me` **THEN** the API still returns 200 (regression check).
- **GIVEN** an unauthenticated request **WHEN** it hits `/api/v1/profiles/me` **THEN** the API returns 401 (unchanged).
- **GIVEN** any authenticated user opens `/dashboard` on the UI **THEN** the profile card renders without the red "API error 403" banner.

## Slice checklist

### API
- [ ] Remove `requireRole(['INDIVIDUAL'])` from the five `/me*` routes in `apps/api/src/modules/profile/profile.routes.ts`. Keep `authenticate`. Keep `requireRole` on `POST /` (create).
- [ ] L2 unit: verify each `/me*` route's middleware chain via a small route-introspection test, OR L3 integration covering the GIVEN/WHEN/THEN above.
- [ ] L3 integration (Testcontainers, in `apps/api/`):
  - Seed an EMPLOYER user with a profile row, hit `GET /profiles/me` with their JWT, assert 200 + correct profile.
  - Same for RECRUITER.
  - INDIVIDUAL still 200.

### Regression
- [ ] `apps/regression/src/flows/02-dashboard-login.spec.ts` — extend so each of `james@`, `rachel@`, `ramesh@` logs in and the dashboard renders without the "Failed to load profile" string. Failing assertion should be `expect(page.locator('text=Failed to load profile')).not.toBeVisible()`.

### Deploy
- [ ] `task dev:deploy:api`. Hit `https://review-dashboard.teczeed.com/dashboard` as james + rachel, confirm no 403.

## Invariants

- Auth still required for every `/me*` route.
- `POST /profiles` (create) stays INDIVIDUAL-only.
- Public `GET /profiles/:slug` is unchanged.
- No schema/migration changes.

## Files

- `apps/api/src/modules/profile/profile.routes.ts` (only file with required code change)
- `apps/api/src/**/__tests__/` (new integration test or extension)
- `apps/regression/src/flows/02-dashboard-login.spec.ts` (extend coverage)

## Don't touch

- `requireCapability` middleware — unrelated, used for paid features, not basic profile read.
- `apps/web/`, `apps/mobile/`, billing, employer, recruiter modules.
- Profile creation rules.
