# Spec 31 — Admin user-actions UI gap

**Status:** GAP — backend exists, UI missing.

## What's missing

`apps/ui/src/pages/AdminPage.tsx` Users tab renders a read-only table.
Two admin operations have working backend endpoints but no UI affordance:

1. **Edit user role** — `PATCH /api/v1/auth/admin/users/:id` with `{ role }`.
   No dropdown / inline edit in the UI.
2. **Suspend / activate user** — `PATCH /api/v1/auth/admin/users/:id/status`
   with `{ status: 'active' | 'suspended' }`. No button in the UI.

## Why it matters

Admins today must hit the API directly (curl or Postman) to perform these
actions. Spec 16 §admin and the seed dataset both assume admins can manage
roles and lifecycle from the dashboard.

## Regression coverage

`apps/regression/src/flows/17-admin-actions.spec.ts` declares two
`test.skip` placeholders pointing at this spec:

- `admin edits a user role inline via Users tab`
- `admin suspends a user via Users tab`

Flip both to active tests once the UI lands. They should:

1. `primeDashboardSession` as `admin@reviewapp.demo`.
2. Navigate to `/admin`, click Users tab.
3. Find a target row (anchor on email).
4. Mutate via the new control.
5. `withDbProxy` assert `users.role` / `users.status` reflect the change.
6. Cleanup — restore the original value.

## Proposed UI

- Role: inline `<select>` per row, options = enum, optimistic update.
- Status: toggle button (`Suspend` / `Activate`) per row, with confirm dialog.

Add testids: `admin-user-role-select`, `admin-user-status-toggle`.
