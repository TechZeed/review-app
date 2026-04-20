# Spec 34 — Public Profile Reputation Page

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Draft (gap discovered while writing regression flow 13-public-profile)
**PRD References:** PRD 01 (every individual is a brand — public reputation page is the "brand"), PRD 03 (review surface), PRD 06 (verified-testimonial badge visible to public).

---

## 1. Problem

Today `/r/:slug` (`apps/web/src/pages/ReviewPage.tsx`) is a **rate-the-person** page — it shows avatar, name, headline, a `<n> reviews` counter, and the quality picker. That's it. There is no public surface that renders:

- Quality breakdown / heatmap (which qualities show up most for this person)
- Review cards (recent feedback the person has received)
- Per-review badges (`verified_interaction`, `verified_testimonial`, etc.) — currently only the dashboard (`apps/ui`) consumes these
- Voice/video media playback

PRD 01 names the public reputation page as the core unit of value: "every individual is a brand, the QR scan is the brand-discovery moment". An unauthenticated visitor scanning Ramesh's QR sees no evidence that he has 150 reviews other than the count badge.

## 2. Goals

- A public, unauthenticated route that renders a profile's reputation surface.
- Header: avatar, display name, headline, current org/role (if public), total review count, verified-individual badge if applicable.
- Quality heatmap: per-quality count + relative weight (top 5 qualities). Drives the `qualityBreakdown` field already returned by `/profiles/:slug`.
- Review feed: paginated cards, default 10 most recent. Each card shows qualities picked, badge tier, optional text/voice/video media.
- Verified-testimonial badge: prominent on cards backed by voice/video evidence (spec 06).
- No login wall.

## 3. Non-goals

- No commenting / reactions on individual reviews.
- No reviewer identity disclosure (public reviews stay anonymous; only badge tier is visible).
- No SEO meta tags work in this spec (handled separately for share previews).
- No "claim this profile" CTA (spec 16 covers signup flow).

## 4. Data / API surface

API already provides most of what's needed:

- `GET /api/v1/profiles/:slug` — header data (already public). Should additionally return `qualityBreakdown` (spec 19 mobile gap also wants this) and verified-individual flag.
- `GET /api/v1/reviews/profile/:profileId` — public, paginated review list. Response should include attached `review_media` for each review so the card can render a quote / play button.

UI:

- New route in `apps/web` — either replace `/r/:slug` (rate page becomes a CTA on the public page) or add `/p/:slug` for the reputation page. PRD 03 leans toward `/r/:slug` being the canonical public URL because that's what's printed on the QR card; the rate flow then becomes a "Leave a review" button on the same page.
- Components: `<ProfileHeader />`, `<QualityHeatmap />`, `<ReviewCardList />`, `<ReviewCard />`, `<VerifiedBadge />`. Add `data-testid` on each so regression flow 13 can un-skip its assertions.

### 4a. Drive-by contract bug

`GET /profiles/:slug` returns `reviewCount` (integer). `apps/web/src/pages/ReviewPage.tsx:95` reads `data.totalReviews ?? data.total_reviews ?? 0`, so the count badge **never renders** in the live app even when the API returns 150 for `ramesh-kumar`. Easiest fix: also read `data.reviewCount` in the fallback chain. Tracked separately in regression flow 13's skipped "review count badge reflects API reviewCount" test.

## 5. Rollout plan

1. Decide the URL question (replace `/r/:slug` vs add `/p/:slug`). Default: replace, with a "Leave a review" CTA preserving the existing flow.
2. Extend `GET /profiles/:slug` to include `qualityBreakdown` + `verifiedIndividual`.
3. Extend `GET /reviews/profile/:profileId` to eager-load `review_media`.
4. Build the components above; add `data-testid="quality-heatmap"`, `data-testid="public-review-card"`, `data-testid="badge-verified-testimonial"`.
5. Un-skip the `quality heatmap` and `verified testimonial badge` tests in `apps/regression/src/flows/13-public-profile.spec.ts`.
