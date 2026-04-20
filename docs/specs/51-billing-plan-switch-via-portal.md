# Spec 51 — Billing: switching plans on an active sub must work, not 409

**Owner:** Hari · **Date:** 2026-04-20 · **Status:** Draft
**Severity:** High — every existing subscriber sees an "Upgrade" button that does nothing.
**Related:** Spec 11 (plans), Spec 28 (capabilities), Spec 48 (capability-as-truth billing redesign).

## Problem (live bug on dev)

Logged in as `ramesh@reviewapp.demo` (currently on Pro Individual, status `active`):

1. Open `/billing`.
2. Click **Upgrade** on any other plan card (e.g. Employer Medium).
3. UI surfaces:

```
API 409: {"error":"Active subscription already exists","code":"ACTIVE_SUBSCRIPTION_EXISTS"}
```

The button is labelled **Upgrade** so the user expects something to happen. Nothing does. There is no path to switch plans without first manually cancelling — and the cancel button is buried in the same card. UX dead-end.

## Root cause

`POST /api/v1/subscriptions/checkout` in `apps/api/src/modules/subscription/subscription.service.ts` rejects with 409 if the user already has an active sub. The endpoint was designed for first-time subscribe, not plan change. The UI calls it for both cases via the same "Upgrade / Subscribe" button.

Stripe's standard pattern for plan change is:
- Either redirect the user to the **Stripe Customer Portal** (Stripe-hosted UI for plan switch + cancel + invoice history), or
- Call `subscriptions.update({ items: [{ id, price: newPriceId }] })` server-side and return success.

Customer Portal is the standard, lowest-effort, lowest-risk option and matches our existing "Stripe-hosted checkout" pattern.

## Decision

Route plan-switch through the **Stripe Customer Portal**. Net change:

- New API endpoint `POST /api/v1/subscriptions/portal` — creates a Stripe Billing Portal session for the current user, returns the URL.
- UI: when user already has an active sub, "Upgrade / Subscribe" buttons on *other* plans become "Switch plan" → calls `/portal` → redirects to Stripe-hosted UI. The current plan card still shows "Cancel" → also routes through `/portal` (or keep the existing cancel endpoint — pick one and stay consistent).

This sidesteps the entire plan-change matrix (proration, mid-period changes, downgrades) — Stripe handles all of it.

## GIVEN / WHEN / THEN

- **GIVEN** Ramesh has an active Pro sub **WHEN** he clicks "Switch plan" on Employer Medium **THEN** the UI POSTs `/api/v1/subscriptions/portal` and redirects him to a `billing.stripe.com/p/session/…` URL (no 409).
- **GIVEN** Lisa has no subscription **WHEN** she clicks "Subscribe" on Pro Individual **THEN** the existing `/checkout` flow runs unchanged → Stripe Checkout (regression check — Spec 6 / Spec 11 unchanged for free users).
- **GIVEN** any subscriber **WHEN** they click "Cancel subscription" **THEN** they're either (a) routed through the same Customer Portal session, or (b) the existing cancel endpoint still works — pick one, document, don't keep both.
- **GIVEN** the API gets `POST /portal` from an unauthenticated user **THEN** 401.
- **GIVEN** the API gets `POST /portal` from a user with no Stripe customer record **THEN** 400 with `code: NO_STRIPE_CUSTOMER` (or auto-create the customer — pick one, don't 500).

## Slice checklist

### L1 contract
- [ ] New endpoint `POST /api/v1/subscriptions/portal` → returns `{ url: string }`.
- [ ] Register schema in `apps/api/src/scripts/generate-openapi.ts`. Regen `docs/openapi.yaml` + `apps/ui/src/api-types.ts`.

### API
- [ ] `SubscriptionService.createPortalSession(userId)`:
  - Look up user's `stripe_customer_id` (already on the subscription row).
  - If missing → 400 `NO_STRIPE_CUSTOMER`.
  - Call `stripe.billingPortal.sessions.create({ customer, return_url: <dashboard-billing-url-from-config> })`.
  - Return `{ url: session.url }`.
- [ ] Controller + route at `POST /subscriptions/portal`. `authenticate` middleware. No role/capability gate (any subscriber can manage their own billing).
- [ ] L2 unit: mock Stripe SDK; assert `billingPortal.sessions.create` called with the correct customer ID and return_url.
- [ ] L3 integration (Testcontainers): seed user with `stripe_customer_id`, hit endpoint, assert 200 + `url` field shape (`https://billing.stripe.com/…`); test the no-customer 400 path.

### UI — `apps/ui/src/pages/BillingPage.tsx`
- [ ] When `subscription.status` is `active` (or `trialing`) and the plan card is **not** the current plan:
  - Button label: `Switch plan` (not `Upgrade` / `Subscribe`).
  - On click: POST `/subscriptions/portal` → `window.location.href = res.url`.
- [ ] Current plan card "Cancel subscription" button: same flow (POST `/portal` → redirect). Remove the existing cancel endpoint call from the UI if we're deprecating it; keep the API endpoint for now (deprecation is its own spec).
- [ ] Free-tier users (no active sub): no UI change — "Subscribe" still goes to `/checkout` → Stripe Checkout.
- [ ] Use generated types from `api-types.ts`; no hand-rolled interfaces.

### L4 MSW tests — `apps/ui/src/__tests__/billing-switch-plan.test.tsx`
- [ ] MSW: `/subscriptions/me` → active Pro sub. Render BillingPage.
- [ ] Assert Employer Medium card shows `Switch plan` button (testid `billing-switch-employer-medium`), not `Upgrade`.
- [ ] Click button → assert MSW intercepted `POST /subscriptions/portal` and `window.location.assign` was called with the mock URL.

### L5 regression — `apps/regression/src/flows/20-billing-active-capabilities.spec.ts`
- [ ] Extend: log in as ramesh, open /billing, click Switch on Employer Medium, assert the page navigates to a `billing.stripe.com` URL (don't actually transact — assert the redirect target host).

### Deploys
- [ ] `task dev:deploy:api` + `task dev:deploy:ui`. Manually verify in browser as ramesh — Switch plan → lands on Stripe portal page.

## Invariants

- `/checkout` endpoint contract unchanged — free users still flow through it.
- No data model changes. `stripe_customer_id` already exists on subscription rows.
- Stripe Customer Portal config (allowed plan changes, cancel rules) is configured in Stripe Dashboard, not in code. Document that prerequisite in the PR description.
- No webhook changes — Stripe's existing `customer.subscription.updated` event already fires; our handler should already pick it up. If it doesn't, that's spec 48's territory, not this one.

## Files

- `apps/api/src/modules/subscription/subscription.service.ts` (add `createPortalSession`)
- `apps/api/src/modules/subscription/subscription.controller.ts` (new handler)
- `apps/api/src/modules/subscription/subscription.routes.ts` (new route)
- `apps/api/src/modules/subscription/subscription.validation.ts` (response schema)
- `apps/api/src/scripts/generate-openapi.ts` (register)
- `apps/api/**/__tests__/`
- `apps/ui/src/pages/BillingPage.tsx` (button labels + new handler)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/billing-switch-plan.test.tsx` (new)
- `apps/regression/src/flows/20-billing-active-capabilities.spec.ts` (extend)
- `docs/openapi.yaml` (regenerated)

## Don't touch

- `/checkout` endpoint — leave the contract alone.
- Webhook handler — separate spec (48).
- `apps/web/`, `apps/mobile/`.
- Stripe Dashboard config (do that manually as a PR prerequisite, document it).

## Stripe Dashboard prerequisite

Before merging the PR: in Stripe Dashboard (test + live), enable Customer Portal and configure:
- Allowed plan changes: any plan ↔ any plan (or a defined matrix per spec 11).
- Cancel: enabled, immediate or at period end (pick — match our current cancel UX).
- Update payment method: enabled.
- Return URL: `https://review-dashboard.teczeed.com/billing` (dev), prod equivalent.
