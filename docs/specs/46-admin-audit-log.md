# Spec 46 — Admin vertical slice: audit log

**Client:** `apps/ui` + infra (new DB table) · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 43 · **Can parallel with:** Spec 47 once slice 45 merges.

## Story

> *As an admin*, I want every privileged action (my own and other admins') to be recorded with who/what/when/why, and I want a filterable log view at `/admin/audit` — so I can retrace a support incident or prove a compliance action.

## Slice checklist

### DB migration (new)

`apps/api/src/db/migrations/20260420-XXXX-admin-audit-log.ts`:

```sql
CREATE TABLE admin_audit_log (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id     UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action       VARCHAR(64) NOT NULL,  -- 'user.create' | 'user.role.change' | 'user.status.change' | 'user.cap.grant' | 'user.cap.revoke' | 'role_request.approve' | 'role_request.reject' | 'user.anonymize'
  target_type  VARCHAR(32) NOT NULL,  -- 'user' | 'role_request' | 'capability'
  target_id    UUID NULL,
  before       JSONB NULL,
  after        JSONB NULL,
  reason       TEXT NULL,
  ip_address   INET NULL,
  user_agent   TEXT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX admin_audit_log_admin_idx ON admin_audit_log (admin_id, created_at DESC);
CREATE INDEX admin_audit_log_target_idx ON admin_audit_log (target_type, target_id, created_at DESC);
CREATE INDEX admin_audit_log_action_idx ON admin_audit_log (action, created_at DESC);
```

### Contract (L1)

- `GET /admin/audit-log?action=&adminId=&targetId=&page=&limit=` → `{ entries: AuditLogEntry[], pagination }` as `AuditLogListResponse`
- Register `AuditLogEntry` + `AuditLogListResponse` in `generate-openapi.ts`.

### API

- [ ] New `AuditLogService.record({adminId, action, targetType, targetId, before, after, reason?, req})` — writes a row. Called from every existing + new admin mutation.
- [ ] Refactor existing admin mutations (create-user, role-change, status-change, grant-cap, revoke-cap, approve/reject role-request) to call `audit.record(...)` after DB commit. Do NOT break their current behaviour — just add the audit write.
- [ ] New route `GET /admin/audit-log` — admin-gated. Paginated, most-recent-first.

### L2 unit

- [ ] `AuditLogService.record` — happy path; handles missing admin (system action); redacts sensitive fields (no raw passwords in `before/after`).
- [ ] `AuditLogService.list({filters, pagination})` — filter combinations.

### L3 integration

- [ ] Approve a role request via API, assert `admin_audit_log` has an `action='role_request.approve'` row with correct targetId.
- [ ] Grant a capability, assert audit row with before=null, after={capability: 'recruiter'}.

### UI (L4)

- [ ] New tab on AdminPage: **"Audit log"** (testid `admin-tab-audit`). Renders a table:
  - Columns: timestamp, admin (email), action, target (link to user detail if target_type=user), reason
  - Filter bar: action dropdown, admin email search, date-range (simple "last 7 days" / "last 30 days" presets)
  - Pagination (testid `admin-audit-pagination`)
- [ ] Response types from generated OpenAPI.

### L4 MSW test

- [ ] `apps/ui/src/__tests__/admin-audit-log.test.tsx` — render tab, MSW mocks `GET /admin/audit-log`, assert rows render; apply a filter, MSW intercepts with filter param, asserts update.

### L5 regression

- [ ] `apps/regression/src/flows/25-admin-audit-log.spec.ts`:
  1. Admin approves a role request (use slice from spec 17's existing flow).
  2. Open Audit log tab, assert the approval appears as the latest row.
  3. Filter by `action=role_request.approve`, assert at least 1 row.
  4. Cleanup: delete the audit row by `id` in afterAll (tag rows by a `testRunId` added to `reason` field for safety).

### Deploys

- [ ] Migration applied to dev DB (`task dev:migrate`).
- [ ] API + UI redeploy. Regression green.

## Files

- `apps/api/src/db/migrations/20260420-XXXX-admin-audit-log.ts` (NEW)
- `apps/api/src/modules/audit/` (NEW module: repo, service, controller, routes, validation)
- `apps/api/src/modules/auth/auth.service.ts` — add `audit.record(...)` call after each admin mutation
- `apps/api/src/app.ts` — mount `/api/v1/audit` under admin auth
- `apps/api/src/scripts/generate-openapi.ts` — register new schemas
- `apps/api/**/__tests__/`
- `apps/ui/src/pages/AdminPage.tsx` (new tab)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/admin-audit-log.test.tsx`
- `apps/regression/src/flows/25-admin-audit-log.spec.ts`

## Don't touch

- Existing admin mutations' return shape or HTTP status codes
- The existing role-request flow
- `apps/mobile/`, `apps/web/`
