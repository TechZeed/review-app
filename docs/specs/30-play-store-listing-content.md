# Spec 30 — Play Store Listing Content as Code

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Implemented (text + 3 screenshots + icon + feature graphic live on Play).
**Related:** Spec 29 (CLI tooling — the scripts that push this content), PRD 01 / 02 / 03 (content sources).
**Huddle decisions:** d31 (contact email), d32 (privacy URL), d33 (short description), d34 (contact website), d35 (first screenshot priority).

---

## 1. Problem

Play Store listings have traditionally been edited by clicking through Play Console's web UI. That loses version history, forces manual screenshot regeneration when dev data changes, and means listing copy drifts from product positioning over time. We needed listing content to live in git like any other product artifact — reviewable in PRs, regenerable on demand, sourced from the PRDs.

Spec 29 built the pipes (auth + push CLIs). This spec is the cargo: what text, what images, drawn from what, with what regeneration workflow.

## 2. Sources of truth

```
apps/mobile/
├── store-listing.yml          # text (title, descriptions, contact, policy URL)
└── store-assets/              # regenerable image set
    ├── icon-512.png
    ├── feature-graphic-1024x500.png
    ├── screenshot-1-scan.png
    ├── screenshot-2-dashboard.png
    └── screenshot-3-profile.png
```

Both are committed. Assets are regenerable via `task dev:play:assets:regenerate` — never hand-edited. YAML is hand-edited in PRs like any copy change.

## 3. Listing copy — current values

```yaml
language: en-GB
defaultLanguage: en-GB
title: ReviewApp
shortDescription: "Every individual is a brand. Your reviews, portable for life."
contactEmail: elan@arusinnovation.com
contactWebsite: https://teczeed.com
privacyPolicyUrl: https://review-scan.teczeed.com/privacy
fullDescription: |
  <~1,800 chars drawn from PRD 01/02/03>
  …ending with: "Built by Arus Innovation Pte Ltd."
```

### 3.1 Decision provenance

- **d31 — contact email**: `elan@arusinnovation.com`. Chosen over `joe@arusinnovation.com` (pre-existing in `PrivacyPage.tsx`); privacy page updated to match in commit `f246fb6`.
- **d32 — privacy policy URL**: `https://review-scan.teczeed.com/privacy`. Pre-existing route on `apps/web` (spec 20 era). Already live, verified 200.
- **d33 — short description**: Dileep's thesis-framing `"Every individual is a brand. Your reviews, portable for life."` Selected over Kishore's feature-promise draft `"Own your reviews. Carry them to your next job."` on the "category-positioning over feature-promise" argument — directly lifts PRD 01's first-line thesis, reads as category definition, not feature list.
- **d34 — contact website**: `https://teczeed.com`. Arus Innovation doesn't have a brand site yet; teczeed.com is the live org domain.
- **d35 — first screenshot priority**: scan page first. Dileep's continuity-of-trust argument: a user installing from the QR-invite funnel just saw the scan page on the mobile browser; the first screenshot should match that visual. Dashboard comes second (what you'll see once you log in); profile third (what others will see of you).

### 3.2 Full description — how it was composed

~1,887 chars drawn from the PRDs:

- **Opening** — PRD 01 §thesis: "Every individual is a brand". Explicitly anti-LinkedIn framing.
- **Body paragraph 1** — portability angle. PRD 01 §3.1 Individual persona ("carry reputation across job changes").
- **Body paragraph 2** — the five qualities framework. PRD 02 naming (Expertise, Care, Delivery, Initiative, Trust) with one-line reframe each.
- **Body paragraph 3** — how reviews are collected: QR scan + phone OTP + optional text/voice/video. PRD 03 §review-flow, PRD 04 §rich-media. Mentions "verified testimonial" badge without unpacking verification depth (Play reviewers don't need the fraud-prevention story; prospective users don't either).
- **Body paragraph 4** — short statement of trust: no fake reviews, no self-reported skills, verifiable. PRD 06 angle, compressed.
- **Sign-off** — "Built by Arus Innovation Pte Ltd." Required for Play content policy (publisher disclosure).

No marketing fluff (`"Transform your career today!"`), no hedge words, no feature bullet lists. Tone: declarative, thesis-first.

### 3.3 Copy maintenance

Treat `store-listing.yml` like a README for the product:

- If PRDs 01–04 change in a way that invalidates the thesis sentence, update both.
- Short description has an 80-char hard limit (Play enforces). Current value: 61 chars — 19 chars of slack.
- Full description has a 4,000-char limit. Current: ~1,887, room to grow.
- Any copy change: PR, review, merge, run `task dev:play:listing:push`.

## 4. Image assets

### 4.1 Icon (512×512)

Derived from `apps/mobile/assets/icon.png` (the 1024×1024 indigo-R monogram that ships in the APK). `magick convert … -resize 512x512 …` is the entire pipeline. When a designer delivers a proper mark, replace the source PNG in `apps/mobile/assets/`; the store icon regenerates from it.

### 4.2 Feature graphic (1024×500)

Placeholder auto-generated by ImageMagick: solid indigo `#4f46e5` canvas + centered white "ReviewApp" wordmark + smaller tagline "Every individual is a brand". Deliberately bland — a designer will replace before external testing promotion. Swap the PNG in `apps/mobile/store-assets/feature-graphic-1024x500.png`; no code change needed.

### 4.3 Phone screenshots (1080×1920 portrait)

Three captures, tied to dev data (re-captured any time the UI ships):

| # | URL | Why |
|---|---|---|
| 1 | `https://review-scan.teczeed.com/r/ramesh-kumar` | **d35 continuity-of-trust**: matches what a QR-funnel user just saw on their phone browser. The scan/landing page. |
| 2 | `https://review-dashboard.teczeed.com/dashboard` (authenticated as `ramesh@reviewapp.demo`) | Post-login reviewee dashboard — "what you get" if you install and sign in. |
| 3 | Ramesh's public profile, scrolled to show review feed | "What others see of you" — the social-proof surface. |

Authentication for #2 reuses regression's `primeDashboardSession` helper pattern (API login → seed localStorage → navigate). Same demo account (`ramesh@reviewapp.demo` / `Demo123`) the regression suite uses.

### 4.4 Image regeneration workflow

```bash
task dev:play:assets:regenerate   # rewrites every file in apps/mobile/store-assets/
git diff apps/mobile/store-assets/ # spot-check the PNGs visually
git add apps/mobile/store-assets/ && git commit
task dev:play:images:push         # uploads to Play
```

Deterministic for icon + feature graphic. Screenshots vary with dev data — that's the point. Ramesh has 150 reviews in dev seed; that's the value the screenshot carries.

## 5. Operational workflow

**First-time setup** (already done 2026-04-19):

```bash
task dev:play:assets:regenerate
task dev:play:listing:push
task dev:play:images:push
task dev:play:status            # verify all green
```

**Copy change** (e.g., new tagline):

```bash
$EDITOR apps/mobile/store-listing.yml
task dev:play:listing:push
```

**Screenshot refresh** (e.g., after UI redesign):

```bash
task dev:play:assets:regenerate
task dev:play:images:push
```

**Icon swap** (designer delivers):

```bash
cp ~/Downloads/new-icon.png apps/mobile/assets/icon.png  # source
task dev:play:assets:regenerate   # regenerates 512×512 variant
task dev:play:images:push
```

## 6. Play Console manual steps that are NOT in this spec

Play's v3 API doesn't expose every listing field. The following are one-time manual steps via Play Console web UI:

- **Privacy policy URL** — set in Play Console → Policy → App content. API's `AppDetails` has no `privacyPolicy` field. The URL is in `store-listing.yml` as the single source of truth; someone has to paste it once.
- **Content rating** — IARC questionnaire flow, not API-exposed.
- **Target audience + content** — Play's "App content" section; API support is partial and Play's UI is authoritative.
- **Data safety form** — newer 2022+ Play policy; some API endpoints exist but coverage is incomplete.

When Play opens these to the API (they move), amend this spec and Spec 29 §8 follow-ups simultaneously.

## 7. Current listing state (2026-04-19, post-push)

| Field | Value | Status |
|---|---|---|
| Title | `ReviewApp` | ✓ set |
| Short description | `"Every individual is a brand. Your reviews, portable for life."` (61 chars) | ✓ set |
| Full description | ~1,887 chars | ✓ set |
| Default language | `en-GB` | ✓ set |
| Contact email | `elan@arusinnovation.com` | ✓ set |
| Contact website | `https://teczeed.com` | ✓ set |
| Privacy policy URL | `https://review-scan.teczeed.com/privacy` | ⚠️ set in YAML; **still needs Play Console UI step** |
| Icon | 512×512 indigo-R | ✓ uploaded (1 image) |
| Feature graphic | 1024×500 placeholder | ✓ uploaded (1 image) |
| Phone screenshots | 3 × 1080×1920 | ✓ uploaded (3 images) |
| Content rating | — | ❌ pending IARC questionnaire (manual) |
| Data safety form | — | ❌ pending (manual, API partial) |

Everything automatable is automated. The three ⚠️/❌ rows are Play-UI-only and block external-testing promotion.

## 8. Invariants

- Every change to `store-listing.yml` or `store-assets/` goes through a commit. No pushing from uncommitted local state.
- `store-assets/` files are always **regenerable** — no hand-edited PNGs committed. If someone's manually touched up a screenshot, rotate it through `capture-store-screenshots.ts` so next regeneration doesn't wipe it.
- Copy mirrors the PRDs. If the PRD thesis changes, the listing changes. Don't let the Play copy drift into marketing that the product doesn't back.
- Contact email must match the privacy policy's `CONTACT_EMAIL` constant in `apps/web/src/pages/PrivacyPage.tsx`. Play reviewers check consistency.
- All locale values live under a single `language: en-GB` today. If we localize, this spec adds a `listings[]` array keyed by language; the push CLI (Spec 29) already supports per-language listing PUTs, no code change needed.

## 9. Follow-ups

- **Designer-delivered feature graphic + icon** to replace placeholders before external testing.
- **Localized listings** (en-IN, ta, hi) when we have a customer in a non-English-primary market.
- **Video trailer** (`store-listing.yml` `videoUrl`) once marketing has a 30-second cut.
- **Screenshot captions** (Play supports up to 4 lines per screenshot as separate overlaid text) — nice-to-have.
- **A/B-test copy** (Play Console supports split tests on title + short description) — worth revisiting post-PMF.
