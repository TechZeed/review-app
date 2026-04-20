# Spec 32 — Employer team seed gap

**Status:** GAP — seed data may not populate james's team list.

## Symptom

`GET /api/v1/employer/team` (called by EmployerPage Team tab) returns an
empty `members` array for `james@reviewapp.demo` in dev, even though
`ramesh@reviewapp.demo` and `priya@reviewapp.demo` are both seeded as
INDIVIDUALs and the brief implies they sit under James's organization.

## Likely cause

The seed in `apps/api/src/db/seeds/` creates the org and the members but
doesn't link them via the join (org membership / consent) row that
`/employer/team` filters on. Spec 13 requires explicit consent before a
member appears in the employer's team view.

## Regression coverage

`apps/regression/src/flows/18-employer-team-detail.spec.ts` —
`Team tab renders member rows…` test. When the list is empty, the test
records a Playwright annotation referencing this spec and asserts only
the empty-state copy. Once seed lands, remove the empty-state branch and
keep the row-shape assertions.

## Fix

In the dev seed:

1. Ensure ramesh + priya have org membership rows pointing at James's
   organization.
2. Set `consent = true` (or whichever flag the team query filters on).
3. Backfill at least one review per member so composite/quality cells
   render non-placeholder values.
