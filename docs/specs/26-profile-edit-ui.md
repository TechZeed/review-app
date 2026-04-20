# Spec 26 — Profile edit UI (gap)

Status: GAP — API exists, UI missing.

## Why

PRD 01 (`docs/prd/01-individual-owns-profile.md` and friends): the
individual owns their profile. They MUST be able to edit headline, bio,
and industry without contacting an admin or going through a developer.

Today (April 2026) the API supports it but the dashboard does not.

## What works

- `PUT /api/v1/profiles/me` — `apps/api/src/modules/profile/profile.routes.ts`
  - Auth required, `INDIVIDUAL` role only.
  - Body validated by `updateProfileSchema` (`profile.validation.ts`).
  - Audit-logged (`profile_updated`).
- `GET /api/v1/profiles/me` returns the current values.

## What's missing

- No edit affordance on `apps/ui/src/pages/DashboardPage.tsx` —
  `ProfileCard` is read-only.
- No edit form / modal component anywhere in `apps/ui/src/`.
- No `updateMyProfile` helper in `apps/ui/src/lib/api.ts` (only
  `fetchMyProfile` / `fetchProfile`).
- No mutation wired into React Query for cache invalidation.

## Acceptance criteria

- An "Edit profile" affordance is reachable from the dashboard
  (`data-testid="edit-profile-button"`).
- Clicking it opens a form pre-populated with the current
  `headline`, `bio`, `industry` (`data-testid="profile-edit-form"`).
- Saving issues `PUT /api/v1/profiles/me`, invalidates the
  `["profile", "me"]` query, and the dashboard re-renders the new
  values without a hard reload.
- Validation errors from the API surface inline (don't drop the
  form's local state).
- Cancel discards local edits without an API call.

## Regression coverage

- `apps/regression/src/flows/15-profile-edit.spec.ts`
  - API-layer round trip (read → mutate → DB → restore) — runs today.
  - Browser flow — `test.skip`-ed with a pointer here. Flip it to a
    real assertion when this spec ships.

## Notes for implementer

- Follow the React Query mutation pattern used elsewhere (see
  `BillingPage.tsx` for an example of `useMutation` + invalidation).
- Keep the form minimal — three text fields, no rich-text editor.
- `industry` should be a free-text input for v1; we can iterate to a
  dropdown later (no enum exists yet).
