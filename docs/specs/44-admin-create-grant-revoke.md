# Spec 44 — Admin vertical slice: create user + grant/revoke capability

**Project:** ReviewApp · **Client:** `apps/ui` only · **Date:** 2026-04-20 · **Status:** Draft — dispatch-ready
**Umbrella:** Spec 43 · **Tests-per-layer contract:** Spec 42.

## Story

> *As an admin*, I want to create a new email+password user from the Admin page, and grant/revoke capabilities (pro / employer / recruiter) on any user's row, so I can onboard demo customers and comp-support accounts without hitting Stripe.

## Why first

All three backend APIs already exist (spec 16 admin + spec 28 capabilities). This slice is pure UI wiring — the highest-value shortest-path close.

## Existing APIs (don't touch)

- `POST /api/v1/auth/admin/create-user` — body `{ email, password, name, role, phone? }` → returns `{ user }`
- `POST /api/v1/auth/admin/users/:id/capabilities` — body `{ capability, reason? }` → returns `{ capability }`
- `DELETE /api/v1/auth/admin/users/:id/capabilities/:capability` → returns `{ revoked: true }`

## Slice checklist (all must be green in the PR)

### Contract (L1)

- [ ] Verify the existing Zod schemas for these endpoints have request **AND** response definitions. If a response shape is inferred at controller level (not a named Zod), extract it into `apps/api/src/modules/auth/auth.validation.ts` as an exported `*ResponseSchema`.
- [ ] Register each new response schema in `apps/api/src/scripts/generate-openapi.ts` so `CreateUserResponse` / `GrantCapabilityResponse` / `RevokeCapabilityResponse` show up in `docs/openapi.yaml`.
- [ ] `task dev:openapi:regen` → `cd apps/ui && npm run codegen` → commit both diffs.

### API (no code changes expected, just a response-schema extraction if needed)

- No new routes, services, migrations.

### L2 unit (API side)

- [ ] If you extracted any response schema, unit-test the service method covering happy + one error path in `apps/api/**/__tests__/`.

### L3 integration

- [ ] One Testcontainers test per endpoint asserting: the HTTP call succeeds + DB reflects the change (row created for create-user; `user_capabilities` row for grant; `expires_at=NOW()` for revoke).

### UI (L4)

- [ ] **Create User modal** on Admin page Users tab. Trigger: new `admin-create-user-btn` (testid) next to the Users tab header. Form fields: email, name, role dropdown, password, phone (optional). On submit → optimistic list refresh. Testids: `admin-create-user-form`, `admin-create-user-submit`.
- [ ] **Grant capability** per-row. Next to the existing role dropdown + status toggle, add a `<select>` with options `pro | employer | recruiter` + a "Grant" button. Testid: `admin-grant-cap-select`, `admin-grant-cap-btn`.
- [ ] **Revoke capability** per-row. Show a chip for every active capability (backed by `/admin/users/:id/capabilities` if it exists, or fetched per-row; pick the lighter option). Chip has an × that calls the DELETE endpoint. Testid: `admin-cap-chip-<capability>`, `admin-revoke-cap-btn-<capability>`.
- [ ] All three UI pieces import response types from `apps/ui/src/api-types.ts` (generated). No local `interface CreateUserResponse {...}`.
- [ ] All three mutations use `useMutation` + `queryClient.invalidateQueries` for the `admin:users` key on success.

### L4 MSW unit tests (per component)

- [ ] `apps/ui/src/__tests__/admin-create-user.test.tsx` — render Users tab, click `admin-create-user-btn`, fill form, MSW mocks `POST /auth/admin/create-user` with a generated-types-typed success response, submit, assert the new row appears + modal closes.
- [ ] `apps/ui/src/__tests__/admin-grant-cap.test.tsx` — render Users tab with a seeded user row, pick "recruiter" in `admin-grant-cap-select`, MSW mocks `POST /auth/admin/users/:id/capabilities`, click Grant, assert the cap chip renders.
- [ ] `apps/ui/src/__tests__/admin-revoke-cap.test.tsx` — mirror, but click × on chip, MSW mocks `DELETE`, assert chip disappears.
- [ ] **Each test's MSW handler must type its response body against `components['schemas']['CreateUserResponse']` etc.** — if the shape drifts, `tsc` fails the test file.

### L5 regression

- [ ] `apps/regression/src/flows/23-admin-create-grant-revoke.spec.ts` — single spec, 3 tests:
  1. Admin creates a new user via UI, asserts `withDbProxy` sees the row, cleans up.
  2. Admin grants `recruiter` to that user, re-fetches the user via API, asserts capability present.
  3. Admin revokes `recruiter`, asserts capability marked expired.
- [ ] Add spec file to `apps/regression/playwright.config.ts` `dashboard` project's testMatch.

### Deploys + gate

- [ ] `gh workflow run deploy.yml -f service=api -f confirm=deploy` (only if a response-schema extraction required API code changes; skip otherwise)
- [ ] `gh workflow run deploy.yml -f service=ui -f confirm=deploy`
- [ ] `task dev:test:regression` green before merge
- [ ] Mark slice 44 as "Shipped" in spec 43 §3.

## Files you may touch

- `apps/api/src/modules/auth/auth.validation.ts` (response schema extraction, only if needed)
- `apps/api/src/scripts/generate-openapi.ts` (register new response schemas)
- `apps/api/**/__tests__/` (L2/L3 tests)
- `apps/ui/src/pages/AdminPage.tsx` (the three new UIs — modal + per-row controls)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/admin-create-user.test.tsx`, `admin-grant-cap.test.tsx`, `admin-revoke-cap.test.tsx`
- `apps/regression/src/flows/23-admin-create-grant-revoke.spec.ts`
- `apps/regression/playwright.config.ts` (add to testMatch)
- `docs/openapi.yaml` (regenerated)
- `docs/specs/43-admin-console-vertical-slices.md` (mark slice 44 shipped)

## Don't touch

- `apps/api/src/modules/auth/auth.routes.ts` routes — they exist.
- `apps/mobile/`, `apps/web/` — not in admin scope.
- Any unrelated UI page.
