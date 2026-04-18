---
status: completed
slug: 24-ui-api-contract-alignment
handoff_from: muthuishere
date: 2026-04-18
packages: [ui]
off_limits:
  - apps/api/**
  - apps/web/**
  - apps/mobile/**
test_frameworks:
  ui: vitest
project_context: ~/config/muthuishere-agent-skills/review-app/project.md
---

## Task

Bring `apps/ui/` types and render logic into alignment with the live API contract
for `/api/v1/profiles/*` and `/api/v1/reviews/*`. The API is correct; the UI is
wrong. Two visible bugs on `review-profile.teczeed.com`:

1. Review cards render `"Invalid Date"` for every review — UI reads
   `review.created_at` but API returns `createdAt`.
2. `QualityHeatMap` on the public profile page can be missing quality bars
   (e.g. ahmed-hassan is missing Expertise) because bars are built by
   aggregating the paginated review list instead of reading the authoritative
   `profile.qualityBreakdown` object the API already provides.

Scope: `apps/ui/` ONLY. No API edits. No other apps. No new runtime
dependencies other than test tooling (vitest + @testing-library/react +
@testing-library/jest-dom + jsdom).

## Acceptance Criteria

### AC1 — `Profile` type mirrors `/api/v1/profiles/:slug`
The exported `Profile` interface in `apps/ui/src/lib/api.ts` MUST be:

```ts
export interface Profile {
  id: string;
  slug: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  industry?: string | null;
  visibility?: string;
  qrCodeUrl?: string | null;
  reviewCount: number;
  qualityBreakdown?: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  profileUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

No `photo_url`, `role`, `org_name`, `total_reviews`, `verifiable_references`, `created_at`. Those fields do not exist on the API response — every consumer must be updated to the new names or the concept removed.

### AC2 — `Review` type mirrors items in `/api/v1/reviews/profile/:profileId`
```ts
export interface Review {
  id: string;
  profileId: string;
  qualities: string[];
  thumbsUp?: boolean;
  badgeTier?: 'verified_interaction' | 'verified' | 'standard' | 'low_confidence';
  verifiable?: boolean;
  createdAt: string;
}
```
No `profile_id`, `media_type`, `text_content`, `verified_interaction`, `verifiable_reference`, `created_at`.

### AC3 — `ReviewsResponse` matches API
```ts
export interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
```

### AC4 — ReviewCard date rendering
`ReviewCard` MUST render the localized date from `review.createdAt`.
If `createdAt` is missing or unparseable, render an empty string — never
the literal `"Invalid Date"`.

### AC5 — QualityHeatMap is driven by `profile.qualityBreakdown`
`ProfilePage` MUST build `QualityBar[]` for `QualityHeatMap` from
`profile.qualityBreakdown`, in this fixed order:
`[Expertise, Care, Delivery, Initiative, Trust]`.

- Always exactly 5 bars, always in that order.
- If `profile.qualityBreakdown` is missing, all 5 bars render with 0%.
- Must NOT iterate over the paginated review list to derive percentages.
- Colors: blue (#3B82F6), pink (#EC4899), green (#22C55E), orange (#F97316), purple (#8B5CF6).

### AC6 — Dashboard consumers updated
`DashboardPage` (and any other consumer of `Profile`/`Review` in
`apps/ui/src`) MUST use the new field names. No lingering `total_reviews`,
`verifiable_references`, `created_at`, `profile.role`, etc. References that
pointed at removed fields must be removed or reshaped — do not paper them
over with `?? 0`.

### AC7 — Tests (Vitest + Testing Library)
Add test scripts to `apps/ui/package.json` (`test`, `test:watch`).
Wire up a minimal vitest config with jsdom + setupFiles importing
`@testing-library/jest-dom`.

Tests to write (co-located `*.test.tsx` beside each source file):

1. `ReviewCard.test.tsx`
   - renders a formatted date for a valid `createdAt`
   - renders empty (no "Invalid Date") when `createdAt` is missing
   - renders empty when `createdAt` is an unparseable string
   - renders all `qualities` as chips

2. `QualityHeatMap.test.tsx` *(if not already present)*
   - renders exactly 5 bars in the default order when no `qualities` prop passed
   - renders bars in the order given by the `qualities` prop
   - percentages and aria-label reflect the data

3. `ProfilePage.test.tsx`
   - fetches profile via mocked `apiFetch`; when `profile.qualityBreakdown` has
     uneven values, all 5 bars render with correct percentages
   - when `profile.qualityBreakdown` is `{expertise:20, care:20, delivery:20, initiative:20, trust:20}` (the ahmed-hassan case), **all 5 bars still render** — Expertise is NOT dropped
   - when `profile.qualityBreakdown` is absent, 5 bars render at 0%
   - name + headline both appear when present
   - renders review list from the paginated response (using nested `pagination`)

Mock strategy: mock the `apiFetch` module (not the network). Wrap components
in a fresh `QueryClientProvider` per test.

All tests pass with `npm run test` in `apps/ui/`.

## Context from Huddle

- API contract was captured live from a local API run (see conversation).
- spec 19 B2 already fixed on the API side; the profile endpoint returns
  camelCase `name`/`headline`/`reviewCount`/`qualityBreakdown` correctly.
- `apps/ui/` was never updated when the API shape changed — this spec is
  catching that drift.
- There is a stashed WIP (`git stash list` → "UI field rename WIP (pre-spec)")
  containing Muthu's earlier partial attempt. Don't restore it; the spec drives
  a fresh, test-backed implementation.

## Style Stance

- Error handling: lean on React Query's error states; no custom error classes
- Validation boundary: n/a (UI only consumes API responses)
- Async style: async/await + React Query
- Logging: `console.log` OK for dev; no framework addition
- Naming: camelCase for all fields, matching API
- File layout: co-located `*.test.tsx` next to source
- Dependencies: add only test tooling (`vitest`, `@testing-library/react`,
  `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`)
- Test style: invoke-and-validate — mock `apiFetch`, render component, assert
  on visible text / aria-label. No deep DOM probing.
- Scope envelope: MVP — just the alignment + tests. No refactoring of unrelated
  code.
- Docs: no README changes needed; spec.md is the durable doc.

## Project Context

This is a monorepo. `apps/ui/` is the logged-in dashboard + public profile
React app (Vite + React 19 + Tailwind + React Query + Firebase Web SDK,
hosted at `review-profile.teczeed.com` and `review-dashboard.teczeed.com`).
Entry: `apps/ui/src/main.tsx`. Route `/profile/:slug` → `ProfilePage`.

Full repo CLAUDE.md lives at the repo root.

## Artifacts (filled in as Sreyash works)

- Spec: docs/specs/24-ui-api-contract-alignment/spec.md
- Tests:
  - apps/ui/src/components/ReviewCard.test.tsx (4 tests)
  - apps/ui/src/components/QualityHeatMap.test.tsx (3 tests)
  - apps/ui/src/pages/ProfilePage.test.tsx (5 tests)
  - apps/ui/vitest.config.ts (new)
  - apps/ui/src/test/setup.ts (new)
  - Result: 12/12 passing, `npm run build` passes.
- Code:
  - apps/ui/src/lib/api.ts — rewrote Profile / Review / ReviewsResponse to match live contract (camelCase, nested pagination, qualityBreakdown)
  - apps/ui/src/components/ReviewCard.tsx — camelCase fields, formatDate returns '' for missing/unparseable dates, Reference chip driven by `verifiable`, Verified chip driven by `badgeTier === 'verified_interaction'`
  - apps/ui/src/components/ProfileCard.tsx — dropped photo_url/role/org_name/verifiable_references; uses headline + reviewCount; 2-col stat grid (Reviews + Industry)
  - apps/ui/src/pages/ProfilePage.tsx — buildQualityBarsFromProfile reads profile.qualityBreakdown in fixed order (always 5 bars); removed Verifiable References card; updated fetchReviews fallback to nested pagination
  - apps/ui/src/pages/DashboardPage.tsx — uses profile.reviewCount, drops References stat card, countThisMonth reads createdAt safely, quality bars come from profile.qualityBreakdown
  - apps/ui/package.json — test scripts + test deps
- Assumptions:
  - Removed the "Reviews render `text_content`" display because the live API does not return review text. ReviewCard now renders only date + badges + quality chips.
  - `verifiable_reference` chip is rendered when `review.verifiable === true` (best mapping from the old boolean to the new one).
  - `verified_interaction` badge is rendered when `review.badgeTier === 'verified_interaction'` (best mapping from old boolean `verified_interaction` to the new tier enum).
  - Dashboard StatCards reduced from 4 to 3 (dropped References). Kept This Month + Quality Score.
  - ProfileCard stat grid reduced from 3 to 2 columns (dropped References).
  - `buildQualityBarsFromProfile` is exported from ProfilePage (used for direct unit testing later if needed); DashboardPage keeps a local copy to avoid cross-page import coupling.
- Blockers: none
