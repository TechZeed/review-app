# Spec 28 — Capability-Based Access

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Draft
**PRD References:** PRD 05 (Monetization — "HR departments hiring frontline roles" listed as Recruiter Access buyers; requires employers to hold recruiter capability simultaneously).
**Huddle decision:** d30 (2026-04-19) — paid features gated by capability, not role. No trial.

---

## 1. Problem

Paid features today are role-gated. `requireRole(['RECRUITER', 'ADMIN'])` on `/recruiter/*`, `requireRole(['EMPLOYER', 'ADMIN'])` on `/employer/*`, etc. Subscription tier is stored on the user but not checked by any route — so `role=EMPLOYER tier=free` gets the same backend access as `role=EMPLOYER tier=employer_small`. And the DB's one-tier-per-user schema forbids an employer from simultaneously holding recruiter access — directly contradicting PRD 05 §2.4 which explicitly names HR departments as a Recruiter Access buyer.

The fix is to decouple **role** (primary persona: individual / employer / recruiter / admin) from **capabilities** (paid features unlocked: `pro`, `employer`, `recruiter`). A user can hold zero or more capabilities concurrently, each tied to a specific subscription.

## 2. Goals

- Any user can hold **multiple capabilities** at once. Employer + Recruiter simultaneously is the motivating example.
- Gating is **capability-based**, not role-based, for every paid feature surface (web + mobile + API).
- `ADMIN` role is an unconditional bypass for operational access.
- No trial, no free grants. Capability comes **only** from an active paid subscription (or admin override for support cases).

## 3. Non-goals

- No change to `role` column semantics — it still identifies the primary persona and gates admin-only functionality.
- No pricing or plan-catalogue changes (prices + Stripe product IDs stay in `.env.dev` as today).
- No promotional / trial / free-tier capability grants.
- No fine-grained per-endpoint permissions (e.g., "can view retention but not export"). A capability either unlocks the whole feature surface or it doesn't.

## 4. Data model

New table:

```sql
CREATE TABLE user_capabilities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  capability  VARCHAR(32) NOT NULL,       -- 'pro' | 'employer' | 'recruiter'
  source      VARCHAR(32) NOT NULL,       -- 'subscription' | 'admin-grant'
  subscription_id UUID NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NULL,            -- NULL = non-expiring (active sub)
  metadata    JSONB NULL,                  -- app_tier, granter_admin_id, reason
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_capabilities_user_active
  ON user_capabilities (user_id, capability)
  WHERE expires_at IS NULL OR expires_at > NOW();
```

**Valid capability values**: `'pro' | 'employer' | 'recruiter'`. Matches the `subscriptions.tier` shape so migration and subscription-activation logic are symmetric.

**Source**: free-form for now, but enforced in code to `'subscription' | 'admin-grant'`. Only these two sources are valid today; trial would be a future addition if we change our minds.

## 5. Middleware

New `apps/api/src/middleware/requireCapability.ts`:

```ts
import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate';

export function requireCapability(cap: 'pro' | 'employer' | 'recruiter') {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    if (user.role === 'ADMIN') return next(); // admin unconditional bypass
    const active = await capabilityRepo.isActive(user.id, cap);
    if (!active) {
      return res.status(403).json({
        error: `This feature requires the ${cap} subscription`,
        code: 'CAPABILITY_REQUIRED',
        requiredCapability: cap,
      });
    }
    next();
  };
}
```

`capabilityRepo.isActive(userId, cap)` = SQL `SELECT 1 FROM user_capabilities WHERE user_id=$1 AND capability=$2 AND (expires_at IS NULL OR expires_at > NOW()) LIMIT 1`. Cheap, uses the partial index above.

## 6. Route migration

Replace role gates on **paid feature** routes. Keep role gates on **admin** routes.

| Route prefix | Before | After |
|---|---|---|
| `/api/v1/recruiter/*` | `requireRole(['RECRUITER','ADMIN'])` | `requireCapability('recruiter')` |
| `/api/v1/employer/*` | `requireRole(['EMPLOYER','ADMIN'])` | `requireCapability('employer')` |
| `/api/v1/organizations` POST/PATCH/DELETE | `requireRole(['EMPLOYER','ADMIN'])` | `requireCapability('employer')` |
| `/api/v1/profiles/me*` | `requireRole(['INDIVIDUAL'])` | **unchanged** — every authenticated user has a personal profile regardless of capability |
| `/api/v1/auth/admin/*` | `requireRole(ADMIN_ROLES)` | **unchanged** — admin is a platform role, not a capability |
| `/api/v1/reviews/*` | mixed | **unchanged** — public / scan-based |
| `/api/v1/subscriptions/*` | authenticated | **unchanged** — everyone can subscribe |

**Pro capability** gets new gates on currently-ungated features only if/when they're implemented (analytics dashboard, custom QR designs, video highlights reel — PRD 05 §2.2). Not scoped here; this spec only migrates existing gates.

## 7. Subscription activation → capability grant

`apps/api/src/modules/subscription/subscription.service.ts` — existing `activateSubscription` (fires on Stripe webhook) extended:

```ts
// After writing the subscription row, upsert the capability.
const capability = subscription.tier; // 'pro' | 'employer' | 'recruiter' (never 'free')
if (capability !== 'free') {
  await capabilityRepo.upsert({
    userId,
    capability,
    source: 'subscription',
    subscriptionId: subscription.id,
    expiresAt: null, // non-expiring while the subscription is active
    metadata: { app_tier: appTier, stripe_subscription_id: stripeSubId },
  });
}
```

**Cancel path** (webhook `customer.subscription.deleted` or `updated` with `cancel_at_period_end`):

```ts
// Mark capability expired at period_end. Grace access until then.
await capabilityRepo.setExpiry(subscriptionId, currentPeriodEnd);
```

**Switch plan** (e.g., employer_small → employer_medium): tier hasn't changed (`employer`), so the capability row stays; only the subscription row's metadata updates.

**Role upgrade path is unchanged**. Admin approving an INDIVIDUAL → EMPLOYER role request does not grant the `employer` capability — the user must subscribe separately. Role lets them access employer-shaped identity + admin intent; capability lets them use employer dashboard features. These are orthogonal.

## 8. Admin-grant escape hatch

Platform admins can grant or revoke capabilities for support scenarios (demo accounts, comped enterprise seats, revoking access on abuse).

- `POST /api/v1/auth/admin/users/:id/capabilities` body `{ capability, expiresAt }` — issues a capability row with `source='admin-grant'`.
- `DELETE /api/v1/auth/admin/users/:id/capabilities/:capability` — sets `expires_at = NOW()`.
- Metadata records `granted_by: adminUserId`, `reason: string`.

Used sparingly. Does **not** replace the subscription flow for revenue users.

## 9. API surface updates

### `GET /api/v1/subscriptions/me`

Extend response to include active capabilities so the frontend can gate UI without a second call:

```json
{
  "tier": "employer",
  "status": "active",
  "billingCycle": "monthly",
  "currentPeriodEnd": "...",
  "capabilities": [
    { "capability": "employer", "source": "subscription", "expiresAt": null },
    { "capability": "recruiter", "source": "subscription", "expiresAt": null }
  ]
}
```

Frontend reads `capabilities` array; presence of a `capability` means feature-on.

### `GET /api/v1/auth/me` (if exists) or token payload

Token payload already carries `role` + `tier`. **Adds `capabilities: string[]`** at issue time, re-issued on subscription state change. Short-lived JWT (60min) so stale capabilities age out; webhook-triggered re-issue is a later enhancement.

## 10. Frontend changes (web)

- `apps/ui/src/App.tsx` `AuthContext.user` shape gains `capabilities: string[]`.
- `apps/ui/src/components/NavBar.tsx`: replace role-based `navItems` with capability-based.
  - `/employer` visible iff `capabilities.includes('employer')`
  - `/recruiter` visible iff `capabilities.includes('recruiter')`
  - `/billing` always visible (authenticated)
  - `/admin` visible iff `role === 'ADMIN'`
  - `/dashboard` visible for everyone except ADMIN (admins have no individual profile).
- `apps/ui/src/pages/EmployerPage.tsx` internal guard: `if (!user.capabilities?.includes('employer') && user.role !== 'ADMIN') return <Navigate to="/billing" replace />;`
- Same pattern for `RecruiterPage.tsx`.
- `BillingPage.tsx`: plan picker no longer filtered by `role`. Any user can buy any plan. Current-plan section lists **all active capabilities**, not just the one matching the user's role.

## 11. Frontend changes (mobile)

Mobile scope (per spec 21 + d18) stays reviewee-first. Capability checks apply where features exist:

- Login flow unchanged.
- Home/Profile/Reviews/Share tabs unchanged (free-tier features).
- **New**: if `capabilities.includes('pro')`, unlock any Pro-tier personal features (not implemented yet; hook is the contract).
- Employer and recruiter features remain web-only for v0.

If a user's capability list changes (admin grant, subscription renewal), they re-authenticate or refresh the token to see it — known stale-JWT behaviour.

## 12. Migration strategy

Zero-downtime rollout:

1. **Ship migration** — add `user_capabilities` table and partial index. Safe — no data touched.
2. **Backfill** — one-shot script: for every user with an active subscription row (`status='active' AND tier!='free'`), insert a corresponding capability row with `source='subscription'`, `expires_at=NULL`. `subscription_id` FK preserves the link.
3. **Dual-read phase** — deploy API with `requireCapability` middleware that **ALSO** accepts the legacy role when `capabilities` table returns empty for that user. Logs a deprecation warning when legacy path taken. This keeps existing real users working while we verify the backfill caught everyone.
4. **Frontend rollout** — deploy UI with capability-gated nav + guards (keeps role fallback internally).
5. **Soak for 24h** — grep logs for the deprecation warning; investigate any users still using legacy path.
6. **Tighten** — remove the legacy-role fallback from `requireCapability`. Routes now strictly capability-gated.

Existing `role` column **is not removed**. It remains the primary-persona signal and drives admin gating.

## 13. Testing

### Unit
- `requireCapability('recruiter')` — rejects user without cap; passes with cap; passes admin regardless.
- `capabilityRepo.isActive` — handles NULL and future expiry correctly.
- Subscription activation → capability row created.
- Subscription cancellation → capability expires at period end.

### Integration
- Subscribe as james@ (EMPLOYER role, no subs) to `recruiter_basic`. Expect: `/recruiter/search` succeeds. `/employer/team` still 403 (no employer capability).
- Subscribe james@ to `employer_small` in addition. Expect: both routes succeed.
- Cancel employer_small. Expect: during grace period both work; after `currentPeriodEnd` `/employer/team` returns 403.
- Admin-grant `recruiter` to priya@. Expect: `/recruiter/search` succeeds.

### Regression (spec 25 suite)
- Amend flows 08-employer, 09-recruiter: add a pre-step that ensures the user has the relevant capability (admin-grant in test-fixture setup if needed), then runs the UI flow. Makes tests independent of role seeding.
- New flow 10-capability.spec.ts: admin-grants recruiter capability to ramesh@ via admin API; asserts ramesh sees `/recruiter` nav link; cleans up.

## 14. Invariants

- Every paid-feature route (anything that gates on a purchased capability) calls `requireCapability(cap)`. Never `requireRole` for revenue-gated things.
- `role === 'ADMIN'` is an unconditional bypass in `requireCapability` — admins can always access any feature for support purposes.
- Capability revocation via admin grant is immediate (no grace); revocation via subscription cancel honours the Stripe `current_period_end` for customer fairness.
- The `role` column is the primary-persona signal. `INDIVIDUAL`, `EMPLOYER`, `RECRUITER` continue to describe identity. Capabilities describe entitlement. Never conflate.

## 15. Open follow-ups

- **Re-issue JWTs on capability change** — webhook-driven token invalidation (out of scope here; spec 16 follow-up).
- **Per-endpoint capability scoping** — if a plan gets tiered (e.g., Recruiter Basic vs Premium where Premium adds contact), move to `requireCapability('recruiter', { minimum: 'premium' })`. Use `app_tier` metadata for the comparison.
- **Pro capability gates** — once Pro Individual features ship (analytics, custom QR, video reel), add `requireCapability('pro')` to those specific endpoints.
