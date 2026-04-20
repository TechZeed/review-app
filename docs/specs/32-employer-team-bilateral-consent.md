# Spec 32 — Employer ↔ Individual Bilateral Consent

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19 (rewritten 2026-04-20 — was seed-gap stub; now full bilateral consent spec per d33)
**Status:** Draft — dispatch-ready
**Supersedes:** the earlier "employer-team-seed-gap" stub of the same number. All prior uses of `profile_organizations.is_current` are deprecated in favour of the `consent_status` field introduced here.
**Huddle decision:** d33 (2026-04-20) — bilateral explicit consent, `is_current` dropped.
**PRD references:** PRD 01 §individual-owns-profile, PRD 01 §3.3 Employer, PRD 05 §2.3 Employer Dashboard.
**Related specs:** Spec 13 (references/employer), Spec 16 (auth/roles), Spec 18-employer pages (Team tab is the primary consumer).

---

## 1. Problem

Today the relationship between an individual and their employer is stored on `profile_organizations` with a single `is_current = true` flag. There is **no explicit consent** — employer visibility depends on whoever writes the row last. The PRDs conflict on initiation:

- **PRD 01**: "Org tags in" (employer-initiated).
- **PRD 05**: "Employer-visible: individual + their current tagged employer **with consent**" (individual-gated).

Either reading alone is wrong for the product. We need **both sides able to initiate, both sides required to confirm**, and a clean revoke path. Since the data is greenfield (dev-only, no prod users yet), we drop `is_current` and redesign the table around a single consent state machine.

## 2. Goals

- Bilateral initiation. Employer can invite an individual; individual can self-tag an employer. Same row, opposite initial state.
- Explicit consent. A row is only visible to the employer's Team tab when **both sides accept**.
- Revocable. Either side can end the relationship; the row enters a terminal `revoked` state, employer's Team tab drops the member silently.
- Seeded demo shows accepted relationships immediately (no click-to-accept during seed).
- PRD 01 sovereignty preserved. Reviews stay with the individual; revoking the employer link doesn't touch review rows.

## 3. Non-goals (v1)

- **Bulk invite** ("upload a CSV of my team"). Single-invite only.
- **Change current org** as a distinct action. Today, "switch jobs" = revoke old + accept new. A combined "change current" CTA is a later UX improvement.
- **Past-employer visibility policies**. When a relationship ends, it's over — no toggle for "stay visible as a past employer for N months".
- **Reference/testimonial flows**. Covered by spec 13, unaffected.
- **Role/permission changes on accept**. Accepting an employer invite does NOT promote the individual's user role to EMPLOYER — it only links them to the org. Role management stays in spec 16.

## 4. Data model

### 4.1 Schema change

Migration file: `apps/api/src/db/migrations/20260420-0001-bilateral-consent.ts`.

Drop `is_current`, add the consent state-machine columns:

```sql
ALTER TABLE profile_organizations
  DROP COLUMN is_current;

ALTER TABLE profile_organizations
  ADD COLUMN origin         VARCHAR(16)  NOT NULL DEFAULT 'admin'      -- 'individual' | 'employer' | 'admin'
                           CHECK (origin IN ('individual','employer','admin')),
  ADD COLUMN consent_status VARCHAR(24)  NOT NULL DEFAULT 'accepted'
                           CHECK (consent_status IN ('pending_individual','pending_employer','accepted','declined','revoked')),
  ADD COLUMN initiated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  ADD COLUMN consent_at     TIMESTAMPTZ  NULL,
  ADD COLUMN revoked_at     TIMESTAMPTZ  NULL,
  ADD COLUMN revoked_by     VARCHAR(16)  NULL
                           CHECK (revoked_by IN ('individual','employer'));

CREATE INDEX profile_organizations_consent_idx
  ON profile_organizations (organization_id, consent_status)
  WHERE consent_status IN ('pending_individual','pending_employer','accepted');

CREATE INDEX profile_organizations_profile_consent_idx
  ON profile_organizations (profile_id, consent_status)
  WHERE consent_status IN ('pending_individual','pending_employer','accepted');
```

**Grandfather clause**: any row existing at migration time gets `consent_status='accepted'`, `origin='admin'`, `initiated_at=NOW()`, `consent_at=NOW()`. Safe because dev-only data, demo seed only.

Down migration restores `is_current` and drops the new columns.

### 4.2 State machine

```
                    employer invites
  (empty)  ─────────────────────────────┐
                                         ▼
                              ┌─ pending_individual ──┐
    individual self-tags      │                        │
  (empty)  ─── ┐              │   individual accepts   │
                ▼             │                        │
          pending_employer    │                        ▼
                │             │                    accepted ◀──────┐
                │             │                      │   ▲         │
    employer    │             │    both             │   │         │
    accepts     ▼             │    declines   │     │ revoked by  │
          pending_individual ─┘   before     ▼     │ individual/ │
                              │   accepted  declined │ employer  │
                              ▼             (terminal) ▼          │
                          accepted                  revoked ──────┘
                                                   (terminal)
```

Only `accepted` rows count for the Team query. `pending_*` rows show up in the respective side's Pending UI. `declined` / `revoked` are terminal and **deleted from the table after 30 days** by a nightly sweep (follow-up, not v1).

### 4.3 Invariants

- A profile can hold at most ONE `accepted` row per organization (`UNIQUE (profile_id, organization_id) WHERE consent_status='accepted'`).
- A profile can hold multiple `accepted` rows across different orgs — "works two jobs" is legal.
- A profile can hold at most ONE `pending_*` row per organization (same unique constraint, different predicate). This prevents invite spam.
- Revoked rows stay in the table for history/audit; they are not reactivated — a new invite creates a new row.

## 5. API surface

All under `/api/v1/profile-organizations` (new mount) + extensions to existing `/api/v1/employer` and `/api/v1/profiles/me` routes.

### 5.1 Individual-initiated

```
POST /api/v1/profile-organizations
  body: { organizationId: string, roleTitle?: string }
  auth: INDIVIDUAL role required
  effect: creates row with { origin:'individual', consent_status:'pending_employer',
                             profile_id: <current user's profile>, organization_id: <body.organizationId> }
  response: 201 { id, status: 'pending_employer', ... }
  errors:
    409 if a pending or accepted row already exists for this (profile, org)
    404 if organizationId doesn't exist
```

### 5.2 Employer-initiated

```
POST /api/v1/organizations/:organizationId/members
  body: { profileSlug: string, roleTitle?: string }
  auth: capability('employer') required; caller must be an EMPLOYER on :organizationId
  effect: creates row with { origin:'employer', consent_status:'pending_individual',
                             profile_id: <resolved from slug>, organization_id }
  response: 201 { id, status: 'pending_individual', ... }
  errors:
    403 if caller's capability isn't scoped to :organizationId
    404 if profileSlug doesn't exist
    409 if duplicate
```

### 5.3 Individual accepts / declines

```
POST   /api/v1/profile-organizations/:id/accept
POST   /api/v1/profile-organizations/:id/decline
  auth: INDIVIDUAL role, must own the profile_id on the row
  effect: transitions pending_individual → accepted (sets consent_at=NOW())
                     pending_individual → declined
  400 if current status is anything else
```

### 5.4 Employer accepts / declines

```
POST   /api/v1/organizations/:organizationId/members/:id/accept
POST   /api/v1/organizations/:organizationId/members/:id/decline
  auth: capability('employer') on :organizationId
  effect: transitions pending_employer → accepted (sets consent_at=NOW())
                     pending_employer → declined
```

### 5.5 Revoke (either side)

```
DELETE /api/v1/profile-organizations/:id            -- individual's side
DELETE /api/v1/organizations/:organizationId/members/:id   -- employer's side
  effect: if status='accepted' → revoked (sets revoked_at=NOW(), revoked_by='individual'|'employer')
          if status starts with 'pending_' → caller-side cancel → declined (not revoked; different semantics)
```

### 5.6 List for each side

```
GET /api/v1/profiles/me/organizations
  auth: INDIVIDUAL
  returns: [{ id, organizationId, organizationName, roleTitle, status, initiatedAt, consentAt, revokedAt }]
  includes all statuses; caller can filter client-side

GET /api/v1/organizations/:organizationId/members?status=accepted|pending_individual|pending_employer|...
  auth: capability('employer') on :organizationId
  returns: { members: [{ id, profileSlug, displayName, roleTitle, status, initiatedAt }] }
```

### 5.7 Team query — the existing `/employer/team` endpoint

Semantic change: **replace** `is_current = true` with `consent_status = 'accepted'`. No response-shape change; callers see the same JSON. Pagination unchanged.

## 6. UI contracts (both sides)

### 6.1 Employer side — `apps/ui/src/pages/EmployerPage.tsx`

- **Team tab** (existing): shows `consent_status='accepted'` rows. Add per-row "Remove from team" button → confirms → `DELETE /organizations/:orgId/members/:id` → row disappears. Testid `employer-remove-member-btn`.
- **Team tab**: add a subsection "Pending employer approval" — rows where `status='pending_employer'` (individual self-tagged, waiting on us). Each row: Accept / Decline buttons. Testids `employer-pending-accept-btn`, `employer-pending-decline-btn`.
- **New section on Team tab**: "Awaiting acceptance" — rows with `status='pending_individual'` (we invited, waiting on them). Cannot be accepted from here — just shown for status. Testid on the container: `employer-pending-individual-list`.
- **Invite UI**: button "Invite member" → modal → input profile slug (future: autocomplete) → submit → `POST /organizations/:orgId/members`. Testid `employer-invite-btn`.

### 6.2 Individual side — `apps/ui/src/pages/DashboardPage.tsx`

- **New section "My organizations"** — lists `GET /profiles/me/organizations` grouped by status:
  - "Current" (accepted) — can "Leave this organization" (revoke). Testid `individual-leave-org-btn`.
  - "Invitations" (pending_individual) — each row: Accept / Decline. Testids `individual-accept-org-btn`, `individual-decline-org-btn`.
  - "Awaiting approval" (pending_employer) — read-only, shows "Waiting on <org>". Cancel link → DELETE (transitions to declined). Testid `individual-cancel-pending-btn`.
- **Self-tag UI**: button "Tag an organization" → modal → input org name or ID (future: autocomplete) → submit → `POST /profile-organizations`. Testid `individual-tag-org-btn`.

### 6.3 Admin side (spec 28's Admin page)

No changes for v1. Admin can still view read-only via existing user/org listing. A "force-link" capability (admin manually accepts a relationship for onboarding / support) is a later spec.

## 7. Seed data

Regenerate `apps/api/src/db/seeds/20260414-0001-demo-data.ts`'s `profile_organizations` block:

- Ramesh and Priya under James's org (acme-corp): `origin='admin'`, `consent_status='accepted'`, `consent_at=NOW()` — demos the happy path.
- Add one `pending_individual` row (employer invited someone who hasn't accepted) for screenshot-worthiness of the pending UI.
- Add one `pending_employer` row (individual self-tagged, employer hasn't accepted) similarly.
- Backfill `reviews` so `/employer/team` composite/quality cells render non-placeholder values (spec 32 old stub §3).

Seed idempotency stays as-is (per spec 04).

## 8. Regression coverage

### 8.1 Replace the current skip

`apps/regression/src/flows/18-employer-team-detail.spec.ts` — the two tests currently skipped against "empty members array" (§gap 32 linkage):

- Unskip the "Team tab renders member rows" test. Assert that ramesh + priya appear in james's team; composite/quality cells render real data.

### 8.2 New flow — `23-bilateral-consent.spec.ts`

Tests (one suite, ~5 tests):

1. **Employer invites, individual accepts**. James invites sarah@. Sarah sees invitation on her dashboard. Accepts. James's Team tab now shows sarah.
2. **Individual self-tags, employer accepts**. Fresh individual (`david@`) self-tags acme-corp. James sees pending row. Accepts. Both see each other as linked.
3. **Decline path** (either side). Asserts row transitions to `declined` and disappears from the opposite side's pending list.
4. **Revoke — individual leaves**. Ramesh leaves acme-corp. James's Team tab drops ramesh. Row status is `revoked`, `revoked_by='individual'`.
5. **Revoke — employer kicks**. James removes priya. Priya sees the org disappear from her "Current" list. `revoked_by='employer'`.

Cleanup: all test-created rows have a `testRunId` suffix on `roleTitle` (we can't add a proper column for this without migration in the test path); sweep via `DELETE FROM profile_organizations WHERE role_title LIKE '%<testRunId>%'` in afterAll.

## 9. Rollout

Single PR (all-or-nothing) because the schema change is load-bearing:

1. Migration.
2. Repo + service updates in `apps/api/src/modules/employer/*` and new `apps/api/src/modules/profile-organization/*` module.
3. Seed regeneration.
4. API endpoints (6 new routes).
5. UI additions on `EmployerPage.tsx` + `DashboardPage.tsx`.
6. Regression updates.
7. Deploy API + UI, verify regression green.

Estimated scope: ~800-1200 LOC across backend + frontend + tests. Big for a Copilot agent; may need to split into two sub-issues if the agent struggles: (a) backend + migration + seed, (b) UI + regression.

## 10. Invariants

- Never bypass the state machine. All transitions go through the service layer, never direct SQL from controllers.
- `accepted` rows are the **only** source for employer-visible team data. No side queries over `pending_*` from employer-facing endpoints except the explicit "pending" list.
- Revoked rows are immutable — don't resurrect them. New consent = new row.
- Admin-created rows (from seed or ops support) use `origin='admin'` + immediate `consent_status='accepted'` + audit log entry.
- PRD 01 sovereignty: revoking an org link never touches `reviews`, `review_media`, or any content the individual owns.

## 11. Follow-ups (not blocking v1)

- **Bulk employer invite** from a CSV of profile slugs.
- **Org-slug autocomplete** on the individual's "Tag an organization" modal.
- **Past-employer view** — pre-PRD surface on profile page showing `revoked` rows older than N months as "previously at X".
- **Admin force-link** for support / onboarding scenarios.
- **Nightly sweep** of `declined` / `revoked` rows older than 30 days.
- **Email/in-app notifications** when a pending row is created (today: user discovers it on dashboard next visit).
