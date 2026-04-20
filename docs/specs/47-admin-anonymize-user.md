# Spec 47 — Admin vertical slice: anonymize user (GDPR-friendly soft delete)

**Client:** `apps/ui` · **Date:** 2026-04-20 · **Status:** Draft
**Umbrella:** Spec 43 · **Requires:** Spec 46 merged (audit log writes on anonymize).

## Story

> *As an admin*, I want to fully anonymize a user on request — email, name, phone, avatar all replaced with tombstones — while keeping their reviews attributable to `[deleted user]` so review history is preserved. This satisfies GDPR "right to erasure" requests without breaking the reputation graph.

## Why soft-delete instead of hard-delete

PRD 01: reviews are attached to the individual, but once written they're part of the customer's (and the org's) historical record. Hard-delete cascades would nuke real user-generated content. Anonymize = erase PII, keep content, mark the user as deleted.

## Slice checklist

### DB migration

`apps/api/src/db/migrations/20260420-YYYY-user-anonymize-flags.ts`:

```sql
ALTER TABLE users
  ADD COLUMN anonymized_at TIMESTAMPTZ NULL,
  ADD COLUMN anonymized_by UUID NULL REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX users_anonymized_idx ON users (anonymized_at) WHERE anonymized_at IS NOT NULL;
```

No changes to `reviews` or `review_media` — reviews stay intact. Profiles: either anonymize in place (blank display_name, strip photo) OR set `profiles.visibility = 'private'` and null the slug. Pick **blank-in-place**: keeps the review→profile FK intact, but public page renders "Deleted user".

### Contract

- `DELETE /admin/users/:id` — **soft delete, idempotent**. Body: `{ reason: string, confirm: "anonymize <email>" }` (string-match guardrail — prevents accidental deletes). Returns `{ anonymizedAt: string, audit: { id: string } }`.
- Register `AnonymizeUserRequest` + `AnonymizeUserResponse` in OpenAPI.

### API behavior (exact spec)

1. Load user. If `anonymized_at IS NOT NULL` → 409 "already anonymized".
2. In a transaction:
   - `UPDATE users SET email='anonymized-<id>@deleted.reviewapp.local', display_name='[Deleted user]', phone=NULL, firebase_uid=NULL, password_hash=NULL, provider='internal', avatar_url=NULL, anonymized_at=NOW(), anonymized_by=<admin_id> WHERE id=$1`
   - `UPDATE profiles SET name='[Deleted user]', headline='', bio=NULL, avatar_url=NULL, visibility='private' WHERE user_id=$1`
   - **Revoke every active capability** — `UPDATE user_capabilities SET expires_at=NOW() WHERE user_id=$1 AND (expires_at IS NULL OR expires_at > NOW())`
   - **Cancel every Stripe subscription (test-mode safe)** — flag as cancelled; do NOT hit Stripe if status is already 'cancelled' or 'none'.
   - Write audit log entry `action='user.anonymize'` with `before={...prior user PII...}` and `reason=<body.reason>`.
3. Do NOT touch `reviews` or `review_media` — the review→profile join still resolves, public page renders "[Deleted user]".
4. Return `{ anonymizedAt, audit: { id } }`.

### L2 unit

- Idempotent (second call returns 409).
- Mismatched `confirm` string → 400 "confirmation mismatch".
- Already-free-tier user — no Stripe cancel attempt.

### L3 integration

- Anonymize ramesh (seeded), assert all 3 UPDATEs landed + capabilities revoked + audit row written.
- `GET /profiles/ramesh-kumar` after — assert 200 with `name='[Deleted user]'`, visibility='private' (so public profile still serves but doesn't dox).

### UI (L4)

- On Admin User Detail page (from spec 45), add a red-framed **"Anonymize this user"** action at the bottom. Opens a confirm modal that requires typing the exact string `anonymize <email>` before the submit is enabled. Testids: `admin-anonymize-btn`, `admin-anonymize-modal`, `admin-anonymize-confirm-input`, `admin-anonymize-submit`.
- On successful response: redirect back to `/admin` with a toast or banner saying "User anonymized". The Users list refreshes and the row shows "[Deleted user]" + status badge "Anonymized".

### L4 MSW test

- `apps/ui/src/__tests__/admin-anonymize.test.tsx` — render modal, type wrong confirm string → submit disabled. Type right string → enabled. Click submit, MSW mocks `DELETE /admin/users/:id` returning `AnonymizeUserResponse`, assert redirect + toast.

### L5 regression

- `apps/regression/src/flows/26-admin-anonymize.spec.ts`:
  1. Create a throwaway user via `POST /admin/create-user` (so we don't anonymize ramesh).
  2. Admin opens detail page, clicks Anonymize, types confirm string, submits.
  3. Assert `GET /profiles/<throwaway-slug>` returns name='[Deleted user]'.
  4. Assert `GET /admin/audit-log?action=user.anonymize&targetId=<id>` has exactly one entry.
  5. Try to anonymize again via API — expect 409.
  6. Cleanup: the anonymized user is our throwaway; leave it (it's tombstoned, harmless).

### Deploys

- Migration applied to dev. API + UI redeploy. Regression green.

## Invariants

- **Never hard-delete users** until a separate spec explicitly says so.
- **Never delete reviews** during anonymize — customers wrote them, they stay.
- **Anonymize writes to audit log** before returning success.
- **`confirm` string guardrail is load-bearing** — don't remove it from the API even if the UI enforces it separately.

## Files

- `apps/api/src/db/migrations/20260420-YYYY-user-anonymize-flags.ts` (NEW)
- `apps/api/src/modules/auth/admin-user.service.ts` (new `anonymize` method)
- `apps/api/src/modules/auth/auth.routes.ts` (add DELETE route)
- `apps/api/src/modules/auth/*.validation.ts` (request + response)
- `apps/api/src/scripts/generate-openapi.ts` (register new schemas)
- `apps/api/**/__tests__/`
- `apps/ui/src/pages/AdminUserDetailPage.tsx` (anonymize button + modal)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/admin-anonymize.test.tsx`
- `apps/regression/src/flows/26-admin-anonymize.spec.ts`
- `docs/openapi.yaml` (regenerated)

## Don't touch

- Existing user-facing flows
- `reviews` / `review_media` tables
- Hard-delete semantics (explicitly out of scope)
- `apps/mobile/`, `apps/web/`
