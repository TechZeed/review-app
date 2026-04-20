# Spec 45 — Admin vertical slice: user search, pagination, and detail view

**Client:** `apps/ui` · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 43 · **Requires:** Spec 44 merged first (AdminPage conflict).

## Story

> *As an admin*, I want to search users by email/name, filter by role + status, paginate through large result sets, and drill into a single user to see their subscriptions, capabilities, reviews received, and recent role changes — so I can diagnose support issues without leaving the admin page.

## Slice checklist

### Contract (L1)

- [ ] Extend `GET /admin/users` validation:
  - `?search` (string, min 2 chars — search across email + name)
  - `?role` (INDIVIDUAL|EMPLOYER|RECRUITER|ADMIN)
  - `?status` (active|suspended)
  - `?page` (int, default 1) + `?limit` (int, default 25, max 100)
  - Response: `{ users: AdminUser[], pagination: { page, limit, total, totalPages } }` (new `AdminUserListResponse` schema)
- [ ] New `GET /admin/users/:id` — returns `{ user: AdminUser, profile: Profile | null, subscription: SubscriptionMe, capabilities: Capability[], recentReviews: Review[] (top 10) }` as `AdminUserDetailResponse`
- [ ] Register both response schemas in `generate-openapi.ts`. Regenerate.

### API

- [ ] Extend `AdminUserRepo.listUsers({search?, role?, status?, page, limit})` with SQL `ILIKE` on email/name, status filter, role filter, `LIMIT/OFFSET`, `COUNT(*) OVER ()` for total.
- [ ] New service `AdminUserService.getUserDetail(id)` — composes user + profile + subscription + capabilities (from spec 28 repo) + recent reviews (from `ReviewRepo`). Returns shape above.
- [ ] New route `GET /admin/users/:id` wired in `auth.routes.ts` alongside existing admin routes.

### L2 unit

- [ ] `AdminUserService.listUsers` — filter combinations; empty result; page 2 edge.
- [ ] `AdminUserService.getUserDetail` — user with no profile (admin); user with multiple capabilities; non-existent id → 404.

### L3 integration

- [ ] Testcontainers test: seed 30 users, query with search+pagination, assert count + page content.
- [ ] Testcontainers test: `GET /admin/users/:id` for ramesh (seeded) → asserts profile + reviews present.

### UI (L4)

- [ ] Users tab: replace the plain table with:
  - Search input (testid `admin-users-search`, 300ms debounce)
  - Role filter select (testid `admin-users-filter-role`)
  - Status filter select (testid `admin-users-filter-status`)
  - Paginated table (testid `admin-users-pagination` — prev/next/page number)
  - Each row: email link → `/admin/users/:id` (new route; testid `admin-user-link`)
- [ ] New route `/admin/users/:id` → new `AdminUserDetailPage.tsx` with sub-sections: Profile, Subscription, Capabilities, Recent reviews (top 10, link to "view all" which opens the existing public profile page).
- [ ] All fetch response types from generated OpenAPI — no local `interface AdminUserDetail {...}`.

### L4 MSW tests

- [ ] `apps/ui/src/__tests__/admin-users-search.test.tsx` — render Users tab, type query, MSW intercepts `GET /admin/users?search=ramesh`, asserts debounced call + row filtered.
- [ ] `apps/ui/src/__tests__/admin-user-detail.test.tsx` — render detail page, MSW mocks `GET /admin/users/:id`, assert subscription + capabilities + reviews sections render.

### L5 regression

- [ ] `apps/regression/src/flows/24-admin-user-search-detail.spec.ts`:
  1. Admin searches `ramesh`, asserts ramesh-kumar row visible, david-chen not.
  2. Admin clicks into ramesh's detail, asserts profile + subscription + capabilities render.
  3. Admin filters role=RECRUITER, asserts rachel + mark visible.
  4. Pagination: seed 30+ users dynamically, navigate page 2, assert table updates.

### Deploys

- [ ] API + UI redeploy. Regression green.

## Files

- `apps/api/src/modules/auth/*.validation.ts`, `auth.service.ts` / `admin-user.service.ts`, `auth.repo.ts` / `admin-user.repo.ts`, `auth.routes.ts`
- `apps/api/**/__tests__/`
- `apps/ui/src/pages/AdminPage.tsx` + NEW `AdminUserDetailPage.tsx`
- `apps/ui/src/App.tsx` (add `/admin/users/:id` route)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/admin-users-search.test.tsx`, `admin-user-detail.test.tsx`
- `apps/regression/src/flows/24-admin-user-search-detail.spec.ts`
- `docs/openapi.yaml` (regenerated)

## Don't touch

- `apps/mobile/`, `apps/web/`
- Existing admin approve/reject flow
- Create/grant/revoke from slice 44 (already shipped)
