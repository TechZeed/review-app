# Spec 50 — Recruiter search 500: missing `recruiter_blocks` table

**Owner:** Harsh · **Date:** 2026-04-20 · **Status:** Draft
**Severity:** Blocker — entire Recruiter feature is dead on dev (and almost certainly local + prod, depending on whether anyone has ever shipped this migration).
**Related:** Spec 12 (recruiter search), Spec 13 (recruiter contact), Spec 28 (capabilities).

## Problem (live bug on dev)

Logged in as `rachel@reviewapp.demo` (RECRUITER), opening `/recruiter` and typing any query (e.g. `ramesh`) immediately shows:

```
Search failed. Please try again.
```

Direct API call confirms the server-side error:

```bash
curl -X POST https://review-api.teczeed.com/api/v1/recruiter/search \
  -H "authorization: Bearer <rachel-jwt>" \
  -H "content-type: application/json" \
  -d '{"query":"ramesh"}'

{"error":"relation \"recruiter_blocks\" does not exist","traceId":"ff4fa538-…"}
```

## Root cause

Code references `recruiter_blocks` in `apps/api/src/modules/recruiter/recruiter.repo.ts` and `recruiter.service.ts` (used by the search query to filter out blocked individuals). **No migration creates this table.** Existing `20260414-0008-create-recruiter.ts` only creates `recruiter_searches`, `contact_requests`, `fraud_flags`, `qualities`, `quality_scores` — not `recruiter_blocks`.

Verify:
```bash
rg -n "createTable.*recruiter_blocks" apps/api/src/db/migrations/   # → no hits
rg -n "recruiter_blocks" apps/api/src/modules/recruiter/             # → repo + service hits
```

So the search SQL joins/excludes against a table that never got created — Postgres returns "relation does not exist" → service throws → controller returns 500.

## Fix

Add a new migration that creates the `recruiter_blocks` table and ship it.

### Inferred schema (read code first; this is the starting hypothesis, not a spec)

```sql
CREATE TABLE recruiter_blocks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recruiter_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason      text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recruiter_id, blocked_user_id)
);
CREATE INDEX recruiter_blocks_recruiter_idx ON recruiter_blocks (recruiter_id);
CREATE INDEX recruiter_blocks_blocked_idx   ON recruiter_blocks (blocked_user_id);
```

**Read `recruiter.repo.ts` + `recruiter.service.ts` before finalising the schema** — use whatever columns the existing queries actually reference. Don't add columns the code doesn't read.

## GIVEN / WHEN / THEN

- **GIVEN** a fresh dev DB **WHEN** `task local:migrate` runs **THEN** `recruiter_blocks` table exists with the columns the repo queries reference.
- **GIVEN** Rachel is logged in **WHEN** she POSTs `/api/v1/recruiter/search` with `{"query":"ramesh"}` **THEN** the API returns 200 with a result list, not 500.
- **GIVEN** Rachel is logged in **WHEN** she opens `/recruiter` and types `ramesh` **THEN** the result list shows Ramesh Kumar with a Contact button (matches doc Journey 5).
- **GIVEN** a recruiter has blocked a user **WHEN** they search **THEN** the blocked user does not appear in the result set.
- **GIVEN** the migration is applied to dev **WHEN** `task dev:logs` is tailed during a recruiter search **THEN** no "relation … does not exist" error appears.

## Slice checklist

### Migration
- [ ] New file `apps/api/src/db/migrations/20260420-0001-create-recruiter-blocks.ts` (Umzug, mirrors style of `20260414-0008-create-recruiter.ts`).
- [ ] `up()` creates table + indexes; `down()` drops cleanly.
- [ ] Run `task local:migrate` against local Postgres → verify table exists via `task local:psql -c '\d recruiter_blocks'`.

### API verification
- [ ] L2 unit: existing recruiter service tests still pass (no behaviour change yet).
- [ ] L3 integration: `apps/api/src/modules/recruiter/__tests__/recruiter.search.test.ts` — seed users + a `recruiter_blocks` row, hit `POST /recruiter/search`, assert (a) blocked user excluded from results, (b) non-blocked returned.
- [ ] If blocking is referenced but the API has no insert path yet, file a follow-up spec — do **not** invent a new endpoint here. The fix is just to make the table exist so search stops 500-ing.

### Regression
- [ ] `apps/regression/src/flows/19-recruiter-search-results.spec.ts` — add an explicit assertion: search for `ramesh` returns at least 1 result + the result list does NOT contain the literal string "Search failed".

### Deploy
- [ ] `task dev:migrate` (Cloud SQL Auth Proxy + Umzug) before `task dev:deploy:api`.
- [ ] After deploy, manually verify in browser as Rachel — `/recruiter` → search "ramesh" → see result.

## Invariants

- Migration is **additive only** — no other tables touched.
- No new endpoints in this spec. Insert/list/delete of blocks belongs to a future spec.
- Don't change the search endpoint contract — same request/response shape.

## Files

- `apps/api/src/db/migrations/20260420-0001-create-recruiter-blocks.ts` (new)
- `apps/api/src/modules/recruiter/__tests__/` (new or extended)
- `apps/regression/src/flows/19-recruiter-search-results.spec.ts` (extend assertion)

## Don't touch

- `apps/api/src/modules/recruiter/recruiter.service.ts` SQL — leave the query as-is; it was correct, the table was just missing.
- `apps/ui/src/pages/RecruiterPage.tsx` — UI is fine, it surfaces the error correctly. Don't muffle real errors.
- Any other module's migrations.

## Verification one-liner

After the migration is live, this should return 200 with results, not 500:

```bash
TOKEN=$(curl -s -X POST https://review-api.teczeed.com/api/v1/auth/login \
  -H "content-type: application/json" \
  -d '{"email":"rachel@reviewapp.demo","password":"Demo123"}' | jq -r .accessToken)

curl -s -X POST https://review-api.teczeed.com/api/v1/recruiter/search \
  -H "authorization: Bearer $TOKEN" \
  -H "content-type: application/json" \
  -d '{"query":"ramesh"}' | jq .
```
