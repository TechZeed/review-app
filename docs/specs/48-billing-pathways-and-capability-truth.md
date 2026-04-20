# Spec 48 — Billing page: capability-as-truth + role-pathway CTAs

**Client:** `apps/ui` + small API fix · **Date:** 2026-04-20 · **Status:** Draft
**Related:** Spec 28 (capabilities), Spec 11 (plans), Spec 42 (testing).

## Problem (from live bug on dev)

Rachel Green's `/billing`:

- Header: **"Recruiter"**, Status `active`, renews 3/21/2026.
- **"Active capabilities: No active paid capabilities."**
- Below: wall of 7 plan cards with generic "Upgrade / Switch plan" buttons.

Two bugs:

1. **Truth split.** Spec 28 says capabilities are the access-control source of truth, but `BillingPage` headline reads `subscription.tier`. When the two disagree (as they do for Rachel) the user sees a direct contradiction.
2. **No pathway UX.** The page lists every plan in every group without framing *what the user is trying to become*. User should see "You're a Recruiter" or "Become a Company" / "Become an Individual Pro" / "Become a Recruiter" as clear entry points.

## Why Rachel's data is inconsistent

Two possibilities — the API fix must cover both:

- **A. Capability row missing.** Stripe checkout succeeded, `subscriptions` row was created, but the capability grant in `user_capabilities` was never written (or was written with `expires_at` in the past). Likely a webhook-handler regression.
- **B. Capability expired while sub stayed active.** `expires_at <= NOW()` on the capability, but the sub wasn't cancelled in Stripe.

Either way, `/subscriptions/me` must return data that is *internally consistent* — if `status='active'` for a paid tier, the matching capability **must** exist; if it doesn't, either re-grant it on read or surface a reconciliation warning.

## Slice checklist

### L1 contract

- [ ] `SubscriptionMe` already includes `tier`, `status`, `capabilities`. Add a new computed field `reconciliation: { consistent: boolean, issues: string[] }` — the API detects tier↔capability mismatch and tells the UI.
- [ ] Register updated schema, regen `docs/openapi.yaml`, regen `apps/ui/src/api-types.ts`.

### API

- [ ] `SubscriptionService.getMe(userId)` — after loading sub + capabilities, compute `reconciliation`:
  - If `status in ('active','trialing')` and `tier in ('pro','employer','recruiter')` but no unexpired capability row for the mapped capability → `consistent=false`, `issues=['tier-without-capability']`.
  - If multiple active capabilities with no matching sub → `issues=['orphan-capability']`.
- [ ] **Self-heal** on read for the `tier-without-capability` case: insert the missing `user_capabilities` row with `source='subscription'`, `expires_at=sub.currentPeriodEnd`, `consent_status` matching spec 28 default. Write an audit log entry `action='capability.self-heal'` (once spec 46 lands; behind a feature flag until then — no-op if audit module absent).
- [ ] L2 unit: `getMe` self-heal path; `getMe` clean path; orphan-capability detection.
- [ ] L3 integration (Testcontainers): seed a user with `status='active', tier='recruiter'` but no capability row; GET `/subscriptions/me`; assert `consistent` returns true and capability row now exists in DB.

### UI — role-pathway redesign

Replace the current "Current plan" card + 3 group sections with:

- [ ] **You are:** card at top. Reads `capabilities` (not `tier`) — lists each as a pill: "Pro Individual", "Employer", "Recruiter". Testid `billing-you-are`.
- [ ] If `reconciliation.consistent === false` → yellow banner "Your subscription is syncing — refresh in a moment" (testid `billing-reconciliation-warning`). The self-heal already happened server-side; the banner is just a trust signal for this one render.
- [ ] **Role pathways** — three horizontal cards, each a *pathway*, not a plan list:
  - `Become a Pro Individual` — 1 sentence value prop; "Choose plan" button expands to monthly/annual options (testid `billing-pathway-individual`, `billing-pathway-individual-expand`).
  - `Become a Company` — same treatment; expands to Small/Medium/Large (testid `billing-pathway-employer`).
  - `Become a Recruiter` — expands to Basic/Premium (testid `billing-pathway-recruiter`).
- [ ] If the user already has a capability in a group → pathway card renders "You're a Recruiter" state with "Change plan" + "Cancel" buttons instead of "Become a …".
- [ ] Keep the existing checkout flow (POST `/subscriptions/checkout` → Stripe-hosted). No change to mutations.
- [ ] Import every response type from generated OpenAPI. No hand-rolled `interface SubscriptionMe`.

### L4 MSW tests

- [ ] `apps/ui/src/__tests__/billing-pathways.test.tsx` — render page, MSW mocks `/subscriptions/me` with `capabilities=[{capability:'recruiter'}]`. Assert:
  - "You are" section shows a Recruiter pill.
  - Recruiter pathway card shows "Change plan" + "Cancel", not "Become a Recruiter".
  - Individual + Employer pathways show "Become a …".
- [ ] `apps/ui/src/__tests__/billing-reconciliation-warning.test.tsx` — MSW returns `reconciliation: { consistent: false, issues: ['tier-without-capability'] }`. Assert banner renders with testid `billing-reconciliation-warning`.

### L5 regression

- [ ] `apps/regression/src/flows/27-billing-pathways.spec.ts`:
  1. Seed a user with active recruiter sub + matching capability. Open /billing, assert pathway card says "Change plan", not "Become a Recruiter".
  2. Seed a user with active sub but no capability row. Open /billing once; assert reconciliation banner renders. Reload; assert capability row now exists in DB via `withDbProxy` and banner is gone.
  3. Free-tier user — all three pathways render as "Become a …".

### Deploys

- [ ] `task dev:deploy:api` + `task dev:deploy:ui`. Regression green.

## Invariants

- **Capabilities are the source of truth, not `tier`.** UI must render from `capabilities[]`. `tier` is a display detail of the underlying sub row.
- **`/subscriptions/me` is self-healing.** The UI never needs to call a separate "fix my capability" endpoint.
- **Don't change the Stripe checkout body shape** — existing mutations keep working.
- **Self-heal only inserts the capability; never touches Stripe.** If the sub is really wrong, that's a separate reconciliation job.

## Files

- `apps/api/src/modules/subscription/subscription.service.ts` (reconciliation + self-heal)
- `apps/api/src/modules/subscription/subscription.validation.ts` (add `reconciliation`)
- `apps/api/src/scripts/generate-openapi.ts` (register updated schema)
- `apps/api/**/__tests__/`
- `apps/ui/src/pages/BillingPage.tsx` (rewrite layout; keep mutations)
- `apps/ui/src/api-types.ts` (regenerated)
- `apps/ui/src/__tests__/billing-pathways.test.tsx`, `billing-reconciliation-warning.test.tsx`
- `apps/regression/src/flows/27-billing-pathways.spec.ts`
- `docs/openapi.yaml` (regenerated)

## Don't touch

- Stripe webhook handler beyond what's needed (webhook-side repair is a separate spec if we need one).
- `apps/mobile/`, `apps/web/`.
- Checkout / cancel endpoint contracts.
