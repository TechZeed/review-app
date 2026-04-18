# Spec 24 — UI ↔ API Contract Alignment

## Purpose

The live API in `apps/api/` returns camelCase JSON that the `apps/ui/` React
app has never been updated to consume. Two user-visible defects on
`review-profile.teczeed.com`:

1. `apps/ui/src/components/ReviewCard.tsx` renders `Invalid Date` because it
   reads `review.created_at` while the API returns `createdAt`.
2. `apps/ui/src/pages/ProfilePage.tsx` builds `QualityHeatMap` bars by
   aggregating the paginated review list (`buildQualityBars(reviews)`)
   instead of reading the authoritative `profile.qualityBreakdown` object the
   API already returns. Profiles whose first page of reviews happens to omit a
   quality (e.g. `ahmed-hassan`) render a heatmap missing that bar.

This spec realigns `apps/ui/src/lib/api.ts` types and every consumer
(`ProfileCard`, `ReviewCard`, `ProfilePage`, `DashboardPage`) with the live
contract captured from `/api/v1/profiles/:slug`, `/api/v1/profiles/me`, and
`/api/v1/reviews/profile/:profileId`.

## Packages Affected

- ui

## ADDED Requirements

### Requirement: `Profile` type matches `/api/v1/profiles/:slug`

The `Profile` interface exported from `apps/ui/src/lib/api.ts` SHALL mirror
the API response exactly. It MUST include: `id`, `slug`, `name`, optional
`headline`, optional `bio`, optional `industry`, optional `visibility`,
optional `qrCodeUrl`, required `reviewCount`, optional `qualityBreakdown`
(object with numeric `expertise`, `care`, `delivery`, `initiative`, `trust`),
optional `profileUrl`, optional `createdAt`, optional `updatedAt`. It MUST
NOT include `photo_url`, `role`, `org_name`, `total_reviews`,
`verifiable_references`, or `created_at`.

#### Scenario: TypeScript compile of Profile consumers

- **GIVEN** the new `Profile` interface in `apps/ui/src/lib/api.ts`
- **WHEN** `npm run build` runs in `apps/ui`
- **THEN** the build succeeds with no type errors across `ProfileCard`,
  `ProfilePage`, and `DashboardPage`

### Requirement: `Review` and `ReviewsResponse` types match API

`Review` SHALL use camelCase: `id`, `profileId`, `qualities`, optional
`thumbsUp`, optional `badgeTier`, optional `verifiable`, required `createdAt`.
`ReviewsResponse` SHALL wrap `reviews: Review[]` and a nested `pagination:
{ page, limit, total, totalPages }`.

#### Scenario: ReviewsResponse nested pagination

- **GIVEN** `fetchReviews(profileId)` returns an object shaped
  `{ reviews: [...], pagination: { page, limit, total, totalPages } }`
- **WHEN** `ProfilePage` reads `reviewsQuery.data.reviews`
- **THEN** it renders a `ReviewCard` per item without runtime errors

### Requirement: `ReviewCard` renders `createdAt` safely

`apps/ui/src/components/ReviewCard.tsx` SHALL render the localized date from
`review.createdAt`. If `createdAt` is missing, empty, or not a parseable ISO
date, it MUST render an empty string — never `Invalid Date`.

#### Scenario: Valid createdAt renders localized date

- **GIVEN** a `Review` with `createdAt: "2026-04-18T02:30:30.600Z"`
- **WHEN** `ReviewCard` renders
- **THEN** the rendered output contains a human date such as `Apr 18, 2026`
  (or locale equivalent), not `Invalid Date`

#### Scenario: Missing createdAt renders empty

- **GIVEN** a `Review` with `createdAt` undefined
- **WHEN** `ReviewCard` renders
- **THEN** no text node containing `Invalid Date` appears in the DOM

#### Scenario: Unparseable createdAt renders empty

- **GIVEN** a `Review` with `createdAt: "not-a-date"`
- **WHEN** `ReviewCard` renders
- **THEN** no text node containing `Invalid Date` appears in the DOM

#### Scenario: Qualities render as chips

- **GIVEN** a `Review` with `qualities: ["expertise","trust"]`
- **WHEN** `ReviewCard` renders
- **THEN** a chip labeled `expertise` and a chip labeled `trust` are visible

### Requirement: `QualityHeatMap` bars driven by `profile.qualityBreakdown`

`apps/ui/src/pages/ProfilePage.tsx` and `apps/ui/src/pages/DashboardPage.tsx`
SHALL construct the `QualityBar[]` for `QualityHeatMap` by reading
`profile.qualityBreakdown`, in the fixed order
`[Expertise, Care, Delivery, Initiative, Trust]`, using colors
`#3B82F6`, `#EC4899`, `#22C55E`, `#F97316`, `#8B5CF6` respectively. Neither
page MAY aggregate the paginated review list to compute percentages. When
`profile.qualityBreakdown` is absent, all five bars MUST render at 0%. When a
key is absent from `qualityBreakdown`, that bar MUST render at 0% (not be
dropped).

#### Scenario: Full qualityBreakdown renders five bars in fixed order

- **GIVEN** a profile with `qualityBreakdown: {expertise:35, care:12,
  delivery:20, initiative:8, trust:25}`
- **WHEN** `ProfilePage` renders
- **THEN** `QualityHeatMap` receives exactly 5 bars named
  Expertise(35), Care(12), Delivery(20), Initiative(8), Trust(25)

#### Scenario: Uniform qualityBreakdown still renders every bar (ahmed-hassan regression)

- **GIVEN** `qualityBreakdown: {expertise:20, care:20, delivery:20,
  initiative:20, trust:20}`
- **WHEN** `ProfilePage` renders
- **THEN** all 5 bars render — Expertise is not dropped

#### Scenario: Missing qualityBreakdown renders five zero bars

- **GIVEN** a profile with `qualityBreakdown` undefined
- **WHEN** `ProfilePage` renders
- **THEN** `QualityHeatMap` renders 5 bars each at 0%

### Requirement: `ProfileCard` matches new Profile shape

`apps/ui/src/components/ProfileCard.tsx` SHALL NOT reference `photo_url`,
`role`, `org_name`, `total_reviews`, or `verifiable_references`. It SHALL
display `headline` in place of `role`, drop `org_name` and
`verifiable_references` display (API no longer returns them), and use
`reviewCount` for the Reviews stat. The stat grid SHALL be two columns
(Reviews + Industry).

#### Scenario: Headline shown in place of role

- **GIVEN** a profile with `headline: "Senior Sales Consultant"`
- **WHEN** `ProfileCard` renders
- **THEN** the text `Senior Sales Consultant` is visible

#### Scenario: reviewCount shown

- **GIVEN** a profile with `reviewCount: 150`
- **WHEN** `ProfileCard` renders
- **THEN** `150` is visible under the Reviews stat

### Requirement: `DashboardPage` uses new field names

`apps/ui/src/pages/DashboardPage.tsx` SHALL use `profile.reviewCount` for
Total Reviews, drop the References stat card (API no longer provides it),
derive This Month from `review.createdAt`, and build `QualityBar[]` via the
same fixed-order logic from `profile.qualityBreakdown`.

#### Scenario: No references to removed snake_case fields

- **GIVEN** the DashboardPage source after edit
- **WHEN** grepping for `total_reviews`, `verifiable_references`,
  `created_at`, `profile.role`, `profile_id`, `media_type`, `text_content`
- **THEN** zero matches across `apps/ui/src/`

### Requirement: Vitest test tooling installed

`apps/ui/package.json` SHALL declare `test` and `test:watch` scripts.
`apps/ui/vitest.config.ts` SHALL configure jsdom + globals + setupFiles
pointing at `src/test/setup.ts` which imports `@testing-library/jest-dom`.

#### Scenario: npm run test passes

- **GIVEN** tests co-located beside their sources
- **WHEN** `npm run test` runs in `apps/ui`
- **THEN** every test passes
