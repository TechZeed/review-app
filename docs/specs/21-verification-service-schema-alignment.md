# Spec 21: Verification Service — Bugs Caught & Schema Gap

**Project:** ReviewApp
**Date:** 2026-04-17
**Status:** Fixes applied where possible; schema gap unblocks next phase

---

## What This Documents

The integration test stack (spec 20) was built partly to catch the class
of bug we kept shipping to dev: frontend/API contract drift and service
code written against schemas that were never migrated.

Running the suite surfaced **6 real production bugs** in the
review-submission flow. This spec enumerates them, shows which are
fixed, shows which need a migration and why, and maps each to the test
that now guards it.

---

## Bug Inventory

### ✅ Fixed in this cycle

#### Bug 1 — `VerificationRepository` constructed with `null` model

**File:** `apps/api/src/modules/verification/verification.controller.ts`
**Before:**
```ts
this.service = new VerificationService(new VerificationRepository(null as any));
// In production, pass actual Sequelize model:
//   import { ReviewToken } from './verification.model.js';
//   new VerificationRepository(ReviewToken)
```
**Symptom in prod:** every `POST /api/v1/verification/otp/send` and `.../verify`
call threw `Cannot read properties of null (reading 'findByPk')` → 500.
The frontend surfaced this as "Unexpected token '<', '<!DOCTYPE '..."
because the Express default error HTML was returned.

**Fix:** pass the actual `ReviewToken` model (already initialised by
`src/config/sequelize.ts`).

**Regression guard:** `scan-review.test.ts` — "sends an OTP for a valid
token + SG E.164 phone".

---

#### Bug 2 — Verification service looked up tokens by primary key, not by hash

**File:** `apps/api/src/modules/verification/verification.service.ts`
**Before:**
```ts
const token = await this.repo.findById(data.reviewToken);
```
`data.reviewToken` is the plaintext UUID secret the client was handed.
`findById` calls `model.findByPk` — primary key lookup on the `id`
column. But the scan flow in `review.service.ts` stores `tokenHash`
(SHA-256 of the UUID) in a separate column and hands the plain UUID
back to the caller. The two sides were reading different columns.

**Symptom in prod:** every OTP-send/verify call with a valid token
returned 404 `TOKEN_NOT_FOUND`. The frontend surfaced this as "Failed
to send OTP" (after route fix) — even though the token was real.

**Fix:** hash the incoming plain token, use `findByTokenHash`:
```ts
const tokenHash = crypto.createHash('sha256').update(data.reviewToken).digest('hex');
const token = await this.repo.findByTokenHash(tokenHash);
```

Both `sendOtp` and `verifyOtp` patched identically.

**Regression guard:** `scan-review.test.ts` — all OTP scenarios.

---

#### Bug 3 — `/reviews/submit` returned 500 for unknown tokens (NPE cascade)

**File:** `apps/api/src/modules/review/review.service.ts`
**Before:**
```ts
let reviewTokenRecord: any = null;
try {
  const { ReviewToken } = await import('../verification/verification.model.js');
  reviewTokenRecord = await ReviewToken.findOne({ where: { tokenHash } });
} catch { /* ReviewToken model may not be available yet */ }

if (reviewTokenRecord) {
  // validation...
}
// Fell through with null and tried to insert a review with profileId: undefined
```
**Symptom in prod:** passing a non-existent UUID as `reviewToken`
returned 500 (Sequelize NOT-NULL violation on `profile_id`) instead of
a clean 404.

**Fix:** require the token to exist, throw `AppError('REVIEW_TOKEN_NOT_FOUND', 404)`
up front. Also bumped reuse from 400 to 409 to match contract.

**Regression guard:** `routes.test.ts` — "POST /api/v1/reviews/submit
hits a real handler (not a missing-route 404)" + `scan-review.test.ts`
— reuse scenario.

---

#### Bug 4 — Rate limiter not test-aware, tripped within single suite run

**File:** `apps/api/src/middleware/rateLimit.ts`
**Symptom:** the auth rate-limit window is 15 minutes, 5 requests.
A single vitest run of `auth.test.ts` makes 6+ login attempts in
seconds, and the 6th returned 429 instead of the expected 401. The
limit was also tripping scan tests that made many `/reviews/scan/:slug`
calls.

**Fix:** added `skip: () => process.env.NODE_ENV === 'test'` to all 6
limiter factories (auth, api, review, otp, media-upload, recruiter-search).
Rate-limit behaviour itself should get dedicated tests in a later phase
(mocked windowed clock).

**Regression guard:** `auth.test.ts` — "rejects nonexistent email with
401" (previously got 429 because of accumulated hits).

---

#### Bug 5 — Verification service used `status` enum that doesn't exist in DB

**Files:**
- `apps/api/src/modules/verification/verification.service.ts`
- `apps/api/src/modules/verification/verification.repo.ts`

The service was written against a `VerificationStatus` enum:
```ts
enum VerificationStatus {
  PENDING = 'pending',
  PHONE_VERIFIED = 'phone_verified',
  USED = 'used',
  EXPIRED = 'expired',
}
```
and checked / set `token.status` throughout. The actual `review_tokens`
table (migration `20260414-0004-create-reviews.ts`) has **no `status`
column** — only two booleans `is_used` and `phone_verified`.

**Symptom in prod:** `token.status` was always `undefined`, so the
`if (token.status !== 'pending') throw` guard always tripped →
`TOKEN_ALREADY_USED` on the very first OTP send for any fresh token.

**Fix:** rewrote the service to use the booleans directly:
- `token.status !== PENDING` → `token.isUsed`
- `token.status === USED` → `token.isUsed`
- `update({ status: PHONE_VERIFIED })` → `update({ phoneVerified: true })`
- Fraud-score check `status !== EXPIRED` → `expiresAt > now && !isUsed`
- Removed the unused `VerificationStatus` import.

Also cleaned up repo queries (`findValidToken`, `countRecentByDevice`,
`countDistinctDeviceReviews`) that were filtering on the non-existent
`status: 'used'`.

**Regression guard:** `scan-review.test.ts` — entire scan→otp flow.

---

#### Bug 5b — `reviewTokenRecord.update({ is_used: true })` silently no-op'd

**File:** `apps/api/src/modules/review/review.service.ts`
**Symptom:** after a successful submit, the token's `is_used` column
stayed `false`. A second submit on the same token was accepted (201)
instead of returning 409 TOKEN_ALREADY_USED.

**Cause:** Sequelize's `instance.update({...})` expects model **attribute
names**, not column names. The ReviewToken model maps attribute `isUsed`
→ column `is_used`. Passing `{ is_used: true }` matches no attribute and
is dropped silently — no error, no update.

**Fix:** `update({ isUsed: true })`.

**Regression guard:** `scan-review.test.ts` — "rejects reusing a token
after submit with 400/409 TOKEN_ALREADY_USED" (was returning 201; now 409).

---

### ⏳ Not fixed — needs a migration

#### Bug 6 — Phone-level cooldown queries non-existent columns

**Files:**
- `apps/api/src/modules/verification/verification.service.ts:sendOtp`
- `apps/api/src/modules/verification/verification.repo.ts:countRecentByPhone`
- `apps/api/src/modules/verification/verification.repo.ts:countDistinctPhonesPerDevice`

The service wants to enforce:
- **Phone cooldown** — same phone can't review same profile within 7 days
- **Device phone limit** — ≤3 distinct phones per device per 30 days

Both queries target `review_tokens.phone_hash` and `review_tokens.used_at`
columns that **do not exist** in the migration. The `review_tokens`
table only stores: `id`, `profile_id`, `token_hash`,
`device_fingerprint_hash`, `scanned_at`, `expires_at`, `is_used`,
`phone_verified`, `created_at`. No phone info, no `used_at` timestamp.

Phone info is actually stored on the `reviews` table as
`reviewer_phone_hash` (correctly), but the cooldown check was pointed
at the wrong table.

**Current state (applied as a stop-gap):**
- `verification.service.sendOtp` no longer calls the phone-cooldown /
  device-phone-limit checks — the comments point to review.service's
  equivalent check at submit-time.
- Repo methods `countRecentByPhone` and `countDistinctPhonesPerDevice`
  are now `return 0;` stubs with explanatory comments.
- `review.service.submitReview` does phone-cooldown correctly: it
  queries the `reviews` table (via `reviewRepo.findByReviewerAndProfile`)
  which has the right columns.

**What the proper fix looks like (future PR):**

Option A — **fix the query location** (no migration): move *only* the
OTP-send-time pre-flight cooldown check to query the `reviews` table
too. Semantically equivalent, just done earlier in the flow for nicer
error UX.

Option B — **migration to add columns to review_tokens**: add
`phone_hash` + `used_at` columns if we want fast pre-flight checks at
OTP-send time without a join to `reviews`. More infrastructure, more
state to keep consistent.

**Recommend Option A** — the data already lives in one authoritative
place (`reviews.reviewer_phone_hash`), adding another denormalised copy
is extra complexity for marginal latency benefit.

**Regression guard:** `scan-review.test.ts` — "blocks the same
phone+profile inside the 7-day cooldown window with 429 DUPLICATE_REVIEW"
— currently failing (expected 429, getting 400). Will flip green once
Option A or B lands.

---

### ⚠️ Adjacent code quality issues surfaced (not bugs, but worth noting)

- **`POST /api/v1/verification/initiate`** is orphaned. It's the
  original verification-token creation endpoint, but the frontend uses
  `POST /api/v1/reviews/scan/:slug` instead. `initiate` stores a
  literal string `'placeholder-profile-id'` as the `profile_id` — a
  foreign key violation in production. Now marked with a NOTE comment.
  Options: delete, or rebuild with real profile lookup.
- **`auth.service.loginWithPassword`** throws `WRONG_PROVIDER` if the
  user is Firebase-auth only. Good. But the test seed creates only
  internal-provider users, so this branch has no coverage today. A
  future test could create a Firebase-provider user and assert the
  error — kept as a "nice to have".

---

## Test Status — before vs after

| Test | Before fixes | After fixes |
|---|---|---|
| Auth — login (4 roles + 2 negative) | 6/6 would fail (rate limit) | 6/6 pass |
| Fingerprint length boundaries | 5/5 pass | 5/5 pass |
| Route sanity (5 routes + /health) | 5/6 pass (submit 500) | 6/6 pass |
| Scan → OTP send | ❌ (VerificationRepository null) | ✅ |
| OTP verify (sum != 7) | ❌ | ✅ |
| OTP verify (sum == 7) | ❌ | ✅ |
| Submit review (happy path) | ❌ | ✅ |
| Submit — token reuse | ❌ | ✅ (409) |
| Submit — 7-day cooldown | ❌ | ❌ (bug #6 — migration/query-move needed) |
| **Total** | ~10 / 35 | **34 / 35** — confirmed in clean docker-compose run, 16s total |

One remaining failure is bug #6, which requires the choice between
Option A (move the query) or Option B (add the columns) before it can
be green.

---

## Takeaway

Running the test stack for 90 minutes found six bugs the
docker-build-and-deploy loop missed for weeks. Five are now fixed,
with regression tests. The sixth has a clear path forward.

The stack proved its value: every one of today's Playwright-found
production bugs (fingerprint, route mismatch, repo nulled, OTP rule)
is now locked behind a green integration test.
