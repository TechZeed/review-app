# Spec 43 — Admin Console Vertical Slices (umbrella)

**Project:** ReviewApp · **Date:** 2026-04-20 · **Status:** Draft — umbrella
**Scope:** `apps/ui` only. Mobile + web stay out — admin is a web surface.
**Related:** Spec 42 (testing strategy — every slice exercises all 5 layers), Spec 37 (OpenAPI pipeline), Spec 28 (capabilities).

---

## 1. Problem

Admin page today has: role-request approve/reject, read-only user table, role dropdown, suspend toggle. That's ~40% of what an admin actually needs. Missing:

- **No UI for existing APIs**: `POST /admin/create-user`, `POST /admin/users/:id/capabilities`, `DELETE /admin/users/:id/capabilities/:cap`
- **Missing APIs**: user search + pagination, user-detail view, audit log of admin actions, GDPR-style anonymize

Every gap = a support request we can't self-serve. Some are revenue-blocking: the "grant comp capability" flow is how we onboard a demo customer without hitting Stripe.

## 2. Approach — vertical slices

Each slice is a **user story** shipped end-to-end with tests at every layer (spec 42):

```
Zod request+response schemas  →  OpenAPI regen (auto)
       ↓
DB migration (if needed)  +  service  +  route
       ↓
L2: service unit test           L3: integration w/ Testcontainers
       ↓
UI component uses generated OpenAPI types
       ↓
L4: MSW unit test (component + contract)    L5: regression flow
```

**Rule of the slice**: the Copilot PR merges only if the slice is green at every layer. No "I'll write tests later".

## 3. Slice catalogue

| Spec | Story | New API? | New DB? | Dispatch order |
|---|---|---|---|---|
| **44** | Admin creates a new user + grants/revokes capabilities | No (APIs exist) | No | 1st (shortest path, closes the 3 glaring gaps) |
| **45** | Admin searches + paginates users, opens single user detail | Yes — `?search=` + `?page/limit` on `/admin/users`, new `GET /admin/users/:id` | No | 2nd |
| **46** | Admin audit log — every admin mutation writes a row; `/admin/audit-log` reads them | Yes — `GET /admin/audit-log` + writes from every existing admin mutation | **Yes — `admin_audit_log` table** | 3rd (infra-first — once this lands, later slices backfill writes) |
| **47** | Admin anonymizes a user (GDPR-friendly soft delete — blanks PII, keeps reviews) | Yes — `DELETE /admin/users/:id` (soft, anonymize semantics) | No (flag columns exist) | 4th |

**Explicitly deferred** (separate later specs):
- User impersonation (security threat-model first)
- System stats dashboard (BI, not admin)
- Bulk actions
- CSV export

## 4. Acceptance anchor (applies to every sub-spec)

A slice PR merges when all of these are true:

1. **Contract**: new/changed Zod schemas committed in `apps/api/src/modules/*/validation.ts`. `task dev:openapi:regen` run; `docs/openapi.yaml` diff included in the PR.
2. **API**: route + controller + service methods land in a single logical module. No ad-hoc SQL in controllers.
3. **L2 unit**: at least one vitest per new service method covering happy path + one error path. Runs via `npm test` in `apps/api`.
4. **L3 integration**: at least one Testcontainers-backed test per new endpoint, asserting DB state after the HTTP call.
5. **L4 UI MSW**: at least one vitest + MSW unit test per new UI component/mutation in `apps/ui/src/__tests__/`. **The MSW handler must type its mocked response against the OpenAPI-generated `components['schemas']['X']` type** — a wrong-shape mock should fail `tsc`.
6. **L5 regression**: at least one new test in `apps/regression/src/flows/<NN>-admin-<slice>.spec.ts` exercising the journey end-to-end on dev. Skips cleanly with a spec pointer if the slice needs deploys that haven't happened yet.
7. **Deploys**: API + UI redeployed before merge (`gh workflow run deploy.yml -f service=api -f confirm=deploy`, then `service=ui`). Regression suite green against the new deploy.
8. **Docs**: author adds a row to `docs/specs/43-admin-console-vertical-slices.md` §3 marking the slice shipped.

## 5. Non-goals of this umbrella

- Changing existing admin flows that already work (approve/reject role request, role edit, suspend toggle) beyond what a slice naturally touches.
- Rewriting `AdminPage.tsx` into multiple pages as a first move — it can stay a tabbed page; new routes like `/admin/users/:id` land as new components without refactoring the parent.
- Expanding admin UI into `apps/mobile` (spec 21 / d18 — native mobile stays reviewee-only).

## 6. Sequencing + parallelism

- **Serial by default** — slices 44 and 45 both touch `AdminPage.tsx` and would conflict. 46 stands alone (new route + new page). 47 depends on audit log.
- After 44 merges → 45 rebases cleanly → after 45 merges → 46 + 47 can go parallel.
- Each merge → regression green → deploy → next dispatch.

## 7. Follow-ups

- Impersonation (threat-model + audit-log writes + session-stealing safeguards)
- Bulk actions (API: `POST /admin/users/bulk` with action + ids)
- CSV export (`GET /admin/users.csv`)
- System dashboard (DAU, subs, revenue — separate spec, different shape)
