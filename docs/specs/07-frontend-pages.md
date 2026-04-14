# Spec 07: Frontend Pages

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**PRD Refs:** PRD 01 (Core Identity), PRD 02 (Five Qualities), PRD 03 (Review Flow)

---

## 1. Architecture Overview

The product has two distinct frontend applications serving different audiences with fundamentally different requirements.

| Frontend | Audience | Auth | Install | Tech Stack | Hosting |
|----------|----------|------|---------|------------|---------|
| **Review Web** | Customers (reviewers) | None -- phone OTP only for fraud prevention | No install, mobile web | Vanilla JS or Preact (<20KB framework), static HTML shell | CDN edge (Cloudflare/Vercel Edge) |
| **Dashboard App** | Individuals, Employers, Recruiters | Firebase Auth (email, Google, Apple) | SPA, optional PWA | React 18+, TanStack Router, TanStack Query | Standard SPA hosting |

These are separate deployable units. Review Web is optimized for speed and minimal bundle size. Dashboard App is optimized for rich interactivity and data visualization.

---

## 2. Frontend 1: Review Web (Mobile Web)

**Design mandate:** No auth, no install, no scrolling, sub-200KB, sub-1s FCP on 4G. Every screen fits a 375px viewport above the fold.

### 2.1 Review Landing Page

| Attribute | Value |
|-----------|-------|
| **Route** | `/r/:slug` |
| **Component** | `ReviewLanding` |
| **Purpose** | The single most critical UX surface. Customer lands here after QR scan. Must load instantly and guide the customer through quality selection and thumbs-up submission in under 5 seconds. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `ProfileHeader` | Individual's photo (48x48, lazy-loaded with a solid color placeholder), name (20px bold), current org tag and role (14px muted), total review count badge |
| `QualityChips` | Five tappable chips arranged in a 3-2 grid (3 top row, 2 bottom row centered). Each chip: icon + quality name. Unselected: outline style, muted. Selected: filled with brand accent, scale animation (100ms). Tap to select/deselect. Max 2 selected; selecting a 3rd auto-deselects the oldest with a shake animation. Display order randomized per session (seeded by session ID). |
| `InstructionText` | "Tap the qualities that stood out" -- 16px, centered above chips |
| `ThumbsUpButton` | Large circular button (64px diameter), centered below chips. Thumbs-up icon + "Submit" label. Disabled until at least 1 chip selected. On tap: immediate server submission, success animation (checkmark morph, 400ms), then transition to rich media prompt. |
| `ReviewCountBadge` | Small pill showing total reviews (e.g., "214 reviews") below profile header |

#### API Calls

| Trigger | Endpoint | Method | Payload | Response |
|---------|----------|--------|---------|----------|
| Page load | `GET /api/profiles/:slug/review-context` | GET | -- | `{ name, photo_url, org_name, role, total_reviews, slug }` |
| Thumbs-up tap | `POST /api/reviews` | POST | `{ profile_id, qualities: [string], device_fingerprint, timestamp, location?, token }` | `{ review_id, status: "created" }` |

#### State Management

- Local component state only (no global store needed). Fields: `selectedQualities: string[]`, `isSubmitting: boolean`, `isSubmitted: boolean`.
- Profile data fetched on mount and cached in a service worker for repeat visits.
- No TanStack Query -- this frontend is too lightweight for a query library.

#### Performance Requirements

- Initial HTML + CSS + JS bundle: under 200KB total (compressed).
- First Contentful Paint: under 1 second on 4G.
- Time to Interactive: under 1.5 seconds on 4G.
- Profile photo: 48x48 WebP, preloaded via `<link rel="preload">`.
- Service worker caches the shell (HTML + CSS + JS) on first visit for instant repeat loads.
- Inline critical CSS. Defer non-critical JS.

#### Mobile Responsiveness

- Designed for 375px width (iPhone SE 3rd gen). Tested down to 320px (iPhone SE 1st gen).
- No horizontal scrolling. No vertical scrolling. Everything above the fold.
- All tap targets: 44x44px minimum.
- Primary actions (chips, submit) in the bottom 60% of the viewport (thumb-reachable).
- Font sizes: 20px for name, 16px for instruction text, 14px for org/role, minimum 16px for chip labels.

#### Accessibility

- All chips: `role="checkbox"`, `aria-checked`, `aria-label` with full quality description (e.g., "Expertise -- expert in their domain").
- Thumbs-up button: `aria-label="Submit review"`, `aria-disabled` when no chips selected.
- Color contrast: WCAG AA (4.5:1 for body text, 3:1 for large text and UI components).
- Focus order: chips left-to-right top-to-bottom, then submit button.
- Haptic feedback via Vibration API where supported (10ms pulse on chip select, 30ms on submit).
- Screen reader announces selected chip count: "1 of 5 qualities selected."

---

### 2.2 OTP Verification

| Attribute | Value |
|-----------|-------|
| **Route** | Inline modal on `/r/:slug` (no route change) |
| **Component** | `OTPVerification` |
| **Purpose** | Fraud prevention layer. Triggered between thumbs-up tap and review persistence. Lightweight modal overlay -- not a separate page. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `PhoneInput` | Country code selector (auto-detected from browser locale) + phone number field. Large numeric input (16px), auto-focus on mount. |
| `OTPInput` | Six individual digit boxes (40x48px each). Auto-advance cursor on digit entry. Auto-submit on 6th digit -- no submit button needed. |
| `ResendLink` | "Resend code" link, disabled for 30 seconds after send, countdown timer visible. |
| `PrivacyNote` | One-liner: "Your number is used only to verify this review. We never share it." 12px muted text. |

#### API Calls

| Trigger | Endpoint | Method | Payload | Response |
|---------|----------|--------|---------|----------|
| Phone submit | `POST /api/otp/send` | POST | `{ phone, country_code }` | `{ otp_id, expires_in }` |
| OTP auto-submit | `POST /api/otp/verify` | POST | `{ otp_id, code }` | `{ verified: boolean, token }` |

#### State Management

- Local state: `phone: string`, `countryCode: string`, `otpDigits: string[6]`, `otpId: string`, `resendCooldown: number`, `verificationState: 'input' | 'verifying' | 'verified' | 'error'`.

#### Mobile Responsiveness

- Modal fills 90% of viewport width, vertically centered.
- OTP digit boxes sized for thumb tapping on 320px+ screens.
- Numeric keyboard auto-triggered via `inputmode="numeric"`.

#### Accessibility

- Phone input: `aria-label="Phone number"`, `inputmode="tel"`.
- OTP inputs: `aria-label="Digit N of 6"`, `inputmode="numeric"`, `autocomplete="one-time-code"`.
- Error state: `role="alert"` with descriptive message.

---

### 2.3 Rich Media Prompt

| Attribute | Value |
|-----------|-------|
| **Route** | Inline transition on `/r/:slug` (no route change) |
| **Component** | `RichMediaPrompt` |
| **Purpose** | After review submission, offer optional text/voice/video. Auto-dismisses after 3 seconds of inactivity. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `SuccessMessage` | "Review saved!" with a checkmark icon. 20px bold. |
| `PromptText` | "Want to add more?" 16px. |
| `MediaButtons` | Three equally-sized buttons in a row: Text (pencil icon), Voice (microphone icon), Video (camera icon). Each 80x60px minimum. |
| `DoneButton` | Below media buttons. "Done" label, equally prominent as media buttons. |
| `AutoDismissTimer` | Invisible countdown. After 3 seconds of no interaction, auto-transitions to Thank You page. Resets if user interacts with anything. |
| `TextCapture` | Shown if Text tapped. Single textarea, placeholder "What made it great?", 280 char limit with counter (turns red at 260). "Add" submit button. |
| `VoiceCapture` | Shown if Voice tapped. Hold-to-record microphone button with pulsing waveform animation during recording. 15s max, elapsed time counter. On release: auto-playback preview, "Use this" and "Re-record" buttons. Opus/WebM format. Hidden entirely if MediaRecorder API unsupported. |
| `VideoCapture` | Shown if Video tapped. Privacy notice first: "This video will appear on [Name]'s profile." + "OK" button (shown once per session). Then front camera preview, tap-to-start/tap-to-stop. 30s max. On stop: playback preview, "Use this" and "Re-record". 720p max, WebM or MP4. |

#### API Calls

| Trigger | Endpoint | Method | Payload | Response |
|---------|----------|--------|---------|----------|
| Text submit | `POST /api/reviews/:reviewId/media` | POST | `{ type: "text", content: string }` | `{ media_id }` |
| Voice submit | `POST /api/reviews/:reviewId/media` | POST (multipart) | `{ type: "voice", file: Blob }` | `{ media_id, upload_progress }` |
| Video submit | `POST /api/reviews/:reviewId/media` | POST (chunked) | `{ type: "video", chunk: Blob, chunk_index, total_chunks }` | `{ media_id, upload_progress }` |

#### State Management

- Local state: `selectedMedia: 'text' | 'voice' | 'video' | null`, `autoDismissTimer: number`, `textContent: string`, `isRecording: boolean`, `recordingDuration: number`, `mediaBlob: Blob | null`, `uploadProgress: number`.

#### Mobile Responsiveness

- Same 375px target. No scrolling in prompt view.
- Media capture views may extend to full viewport height.
- Voice waveform and video preview: full width, 40% viewport height.

#### Accessibility

- Media buttons: `aria-label="Add text review"`, `"Add voice review"`, `"Add video review"`.
- Done button: `aria-label="Skip additional feedback"`.
- Recording state: `aria-live="polite"` region announcing "Recording... N seconds".
- Upload progress: `role="progressbar"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`.

---

### 2.4 Verifiable Reference Opt-in

| Attribute | Value |
|-----------|-------|
| **Route** | Inline transition on `/r/:slug` (no route change) |
| **Component** | `ReferenceOptIn` |
| **Purpose** | After media step (or skip), ask if the customer would vouch for this person to a future employer. Optional -- Yes or No thanks. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `VouchQuestion` | "Would you vouch for [Name] to a future employer?" -- 20px, centered, bold name. |
| `YesButton` | Primary action button, filled style. "Yes, I would." On tap: records opt-in, transitions to Thank You. |
| `NoThanksButton` | Secondary button, outline style. "No thanks." On tap: transitions to Thank You with no opt-in. |
| `PrivacyExplanation` | Below buttons, 12px muted: "If you say yes, a potential employer may contact you through the app to verify your review. Your phone number stays private." |

#### API Calls

| Trigger | Endpoint | Method | Payload | Response |
|---------|----------|--------|---------|----------|
| Yes tap | `PATCH /api/reviews/:reviewId` | PATCH | `{ verifiable_reference: true }` | `{ updated: true }` |

No API call on "No thanks" -- default state is opt-out.

#### State Management

- Local state: `optInChoice: 'yes' | 'no' | null`.

#### Mobile Responsiveness

- Centered layout. No scrolling. Both buttons full-width stacked vertically (Yes on top, No thanks below).
- Fits 375px viewport comfortably.

#### Accessibility

- Question: `role="heading"`, `aria-level="2"`.
- Buttons: clear `aria-label` values.
- Privacy text: associated with the Yes button via `aria-describedby`.

---

### 2.5 Thank You Page

| Attribute | Value |
|-----------|-------|
| **Route** | Inline transition on `/r/:slug` (no route change) |
| **Component** | `ThankYou` |
| **Purpose** | Confirmation, quality breakdown visualization, optional share. Informational only -- no required action. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `ConfirmationMessage` | "Thanks! You recognized [Name]." 20px. |
| `QualityBreakdown` | Five horizontal bars showing quality distribution percentages. Each bar: quality name (left), filled bar (proportional to %), percentage label (right). Sorted descending by percentage. |
| `ShareButton` | "Share [Name]'s Profile" -- generates a shareable link (copies to clipboard or opens share sheet via Web Share API). |
| `CloseHint` | "You can close this page now." 12px muted, bottom of screen. |

#### API Calls

| Trigger | Endpoint | Method | Payload | Response |
|---------|----------|--------|---------|----------|
| Page render | `GET /api/profiles/:slug/quality-summary` | GET | -- | `{ qualities: [{ name, percentage }], total_reviews, total_picks }` |

This data may already be available from the initial profile load -- cache and reuse if so.

#### State Management

- Read-only. No mutable state. Profile data from cache or a single GET.

#### Mobile Responsiveness

- Fits 375px viewport. Quality bars full-width with padding.
- Share button triggers native share sheet on mobile (Web Share API) with clipboard fallback.

#### Accessibility

- Quality bars: `role="img"`, `aria-label="Expertise: 42%, Care: 35%, Delivery: 20%, Initiative: 15%, Trust: 52%"`.
- Alternative: screen reader reads a text summary instead of the visual bars.
- Share button: `aria-label="Share [Name]'s profile link"`.

---

## 3. Frontend 2: Dashboard App (React SPA)

**Design mandate:** Firebase Auth, role-based routing, TanStack Query for all server state, responsive (mobile-first but desktop-optimized for employer/recruiter views).

### 3.1 Login / Register

| Attribute | Value |
|-----------|-------|
| **Route** | `/login`, `/register` |
| **Component** | `LoginPage`, `RegisterPage` |
| **Purpose** | Firebase Auth entry point. Supports email/password, Google, and Apple sign-in. Role selection on register. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `AuthForm` | Email + password fields with validation. "Sign in" button. "Forgot password?" link triggers Firebase password reset. |
| `SocialAuthButtons` | "Continue with Google" and "Continue with Apple" buttons. Standard Firebase Auth UI. |
| `RoleSelector` | Shown on register only. Three cards: Individual ("I receive customer reviews"), Employer ("I manage a team"), Recruiter ("I hire talent"). Single selection, determines post-login dashboard routing. |
| `AuthToggle` | "Don't have an account? Register" / "Already have an account? Sign in" link. |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Auth actions | Firebase Auth SDK | -- | `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signInWithPopup` (Google/Apple providers) |
| Post-register | `POST /api/users` | POST | `{ firebase_uid, email, role, name }` -- creates backend user record |

#### State Management

- Firebase Auth state via `onAuthStateChanged` listener, stored in React context (`AuthContext`).
- Role stored in backend user record and cached in auth context after login.
- TanStack Query: `useQuery(['user', uid])` to fetch user profile after auth.

#### Mobile Responsiveness

- Single column layout on mobile. Centered card (max-width 400px) on desktop.
- Social auth buttons full-width. 44px minimum height.

#### Accessibility

- Form inputs: associated `<label>` elements, `aria-required`, `aria-invalid` on validation errors.
- Error messages: `role="alert"`.
- Social auth buttons: `aria-label="Sign in with Google"`, `"Sign in with Apple"`.

---

### 3.2 Individual Dashboard

| Attribute | Value |
|-----------|-------|
| **Route** | `/dashboard` (individual role) |
| **Component** | `IndividualDashboard` |
| **Purpose** | The individual's home base. Shows their QR code, quality heat map, reviews, and profile controls. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `ProfileCard` | Photo, name, org tag, role. QR code displayed (200x200px) with "Download QR" button (PNG, SVG options). "Copy profile link" button. |
| `QualityHeatMap` | Five horizontal bars showing quality distribution. Same visualization as Thank You page but interactive -- tap a quality bar to filter reviews by that quality. |
| `SignatureStrengthBadges` | Up to 3 badges shown above heat map when threshold met (40%, 20+ picks). Format: "Known for [Quality]" with quality icon. |
| `ReviewsFeed` | Scrollable list of recent reviews. Each review card shows: date, qualities picked (as small chips), media indicator (text/voice/video icon), "Verified Interaction" badge if applicable. Inline audio player for voice reviews. Inline video player for video reviews. Text reviews shown directly. |
| `StatsRow` | Total review count, reviews this month, trend arrow (up/down/steady vs. prior month). |
| `TrendChart` | Line chart showing review count over time (monthly). Pro tier: quality trend lines overlaid. |
| `VisibilityToggle` | Three-state toggle: Private / Recruiter-visible / Public. Current state highlighted. Change triggers confirmation dialog. |
| `OrgTagManager` | Current org(s) listed with "Untag" button. "Add organization" search field to send tag requests. |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Page load | `GET /api/profiles/me` | GET | Full profile data |
| Page load | `GET /api/profiles/me/quality-summary` | GET | Quality aggregates |
| Page load | `GET /api/profiles/me/reviews?page=1&limit=20` | GET | Paginated reviews |
| Page load | `GET /api/profiles/me/stats` | GET | Review counts, trends |
| QR download | `GET /api/profiles/me/qr?format=png&size=600` | GET | QR code image |
| Visibility change | `PATCH /api/profiles/me/visibility` | PATCH | `{ visibility: 'private' | 'recruiter' | 'public' }` |
| Org untag | `DELETE /api/profiles/me/orgs/:orgId` | DELETE | -- |
| Org tag request | `POST /api/profiles/me/orgs` | POST | `{ org_id }` |

#### State Management

- TanStack Query keys:
  - `['profile', 'me']` -- profile data
  - `['profile', 'me', 'qualities']` -- quality aggregates
  - `['profile', 'me', 'reviews', { page, limit, quality_filter }]` -- paginated reviews
  - `['profile', 'me', 'stats']` -- stats/trends
- Mutations via `useMutation` with optimistic updates for visibility toggle and org tag actions.
- QR download handled as a one-off fetch (blob URL), not cached in query.

#### Mobile Responsiveness

- Single column on mobile (<768px). Profile card and QR code stacked.
- Two column on tablet/desktop (>=768px). Profile card left, heat map + stats right.
- Reviews feed full-width below, cards stack vertically.
- Heat map bars: touch-friendly (44px height each) on mobile.

#### Accessibility

- Heat map bars: `role="img"` with full text alternative via `aria-label`.
- Visibility toggle: `role="radiogroup"` with `role="radio"` for each option.
- Media players: keyboard-accessible play/pause/seek. Captions for video (when available).
- Review feed: `role="feed"` with `aria-label="Recent reviews"`.

---

### 3.3 Public Profile View

| Attribute | Value |
|-----------|-------|
| **Route** | `/profile/:slug` |
| **Component** | `PublicProfile` |
| **Purpose** | Shareable public profile page. Visible based on individual's privacy setting. This is what recruiters, employers, and the public see. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `ProfileHero` | Large photo (96x96), name, role, org tag, signature strength badges. |
| `QualityHeatMap` | Same visualization as dashboard, read-only. |
| `ReviewsList` | All reviews with media. Voice reviews: inline audio player. Video reviews: inline video player with poster frame. Text reviews: displayed directly. Each review shows: date, qualities picked, "Verified Interaction" badge, "Verifiable Reference" badge (if customer opted in). |
| `VerifiableReferenceCount` | Prominent count: "N verifiable references" with explanation tooltip. |
| `ReviewFilters` | Filter by quality, filter by media type (text/voice/video), sort by recent/oldest. |
| `ProfileMeta` | Total reviews, member since date, industries/roles served. |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Page load | `GET /api/profiles/:slug` | GET | Full public profile data |
| Page load | `GET /api/profiles/:slug/quality-summary` | GET | Quality aggregates |
| Page load | `GET /api/profiles/:slug/reviews?page=1&limit=20` | GET | Paginated reviews |
| Filter/sort | Same as above with query params | GET | `?quality=Care&media=video&sort=recent` |

#### State Management

- TanStack Query keys:
  - `['profile', slug]` -- profile data
  - `['profile', slug, 'qualities']` -- quality aggregates
  - `['profile', slug, 'reviews', { page, filters, sort }]` -- paginated reviews
- No mutations -- this is a read-only view.

#### Mobile Responsiveness

- Single column, mobile-first. Profile hero stacked above heat map.
- Media players responsive (full-width on mobile, max 640px on desktop).
- Review cards stack vertically. Filter controls collapse into a dropdown on mobile.

#### Accessibility

- Same as Individual Dashboard for heat map and media players.
- Profile hero: heading hierarchy (h1 for name, h2 for sections).
- Review list: `role="list"`, each review `role="listitem"`.
- Badges: `aria-label` explaining what "Verified Interaction" and "Verifiable Reference" mean.

---

### 3.4 Employer Dashboard

| Attribute | Value |
|-----------|-------|
| **Route** | `/employer` (employer role) |
| **Component** | `EmployerDashboard` |
| **Purpose** | Team overview. See tagged individuals, their scores, top performers, and location-level stats. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `TeamOverview` | Table/list of tagged individuals. Columns: photo + name, role, total reviews, top quality (highest percentage), trend (up/down/steady). Sortable by any column. Clickable row for drill-down. |
| `TopPerformers` | Leaderboard card showing top 5 individuals by total reviews (or by a selected quality). Toggleable: "Most Reviewed" / "Highest Care" / etc. |
| `LocationStats` | If org has multiple locations: aggregate stats per location. Card grid showing location name, total team members, total reviews, average quality distribution. |
| `IndividualDrillDown` | Side panel or full page showing a single team member's quality heat map, recent reviews, and trend chart. Read-only -- employer cannot edit. |
| `DateRangeFilter` | Filter all data by date range (last 7 days, 30 days, 90 days, custom). |
| `ExportButton` | Export team data as CSV. |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Page load | `GET /api/employer/team` | GET | List of tagged individuals with summary stats |
| Page load | `GET /api/employer/leaderboard?metric=reviews&limit=5` | GET | Top performers |
| Page load | `GET /api/employer/locations` | GET | Location-level aggregates |
| Drill-down | `GET /api/employer/team/:profileId` | GET | Individual detail for employer view |
| Date filter | Same endpoints with `?from=&to=` | GET | Date-filtered data |
| Export | `GET /api/employer/team/export?format=csv` | GET | CSV download |

#### State Management

- TanStack Query keys:
  - `['employer', 'team', { sort, dateRange }]` -- team list
  - `['employer', 'leaderboard', { metric, limit }]` -- leaderboard
  - `['employer', 'locations']` -- location stats
  - `['employer', 'team', profileId]` -- individual drill-down
- Date range and sort stored in URL search params (shareable/bookmarkable).

#### Mobile Responsiveness

- Team table: horizontal scroll on mobile (<768px), or collapse to card view.
- Leaderboard: single column card stack on mobile.
- Location stats: card grid (1 column mobile, 2 tablet, 3 desktop).
- Drill-down: full page on mobile, side panel on desktop (>=1024px).

#### Accessibility

- Team table: proper `<table>` semantics with `<th scope="col">`, sortable columns with `aria-sort`.
- Leaderboard: `role="list"`, ranked items with `aria-label="Rank N"`.
- Date range filter: accessible date picker with keyboard navigation.

---

### 3.5 Recruiter Search

| Attribute | Value |
|-----------|-------|
| **Route** | `/recruiter`, `/recruiter/search`, `/recruiter/saved` |
| **Component** | `RecruiterDashboard`, `RecruiterSearch`, `SavedSearches` |
| **Purpose** | Search and discover individuals by quality scores, industry, location, and review count. View profiles, request contact. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `SearchFilters` | Sidebar (desktop) or expandable panel (mobile) with: industry dropdown, location (city/region), minimum review count slider, quality score filters (minimum percentage for each quality -- e.g., "Care > 40%"), media type filter (has video reviews: yes/no). |
| `ResultsList` | Card grid of matching profiles. Each card: photo, name, role, org, total reviews, top 2 qualities as chips, signature strength badges. Click to view full profile. |
| `ProfileDetailView` | Full profile view (same as Public Profile) with additional recruiter actions: "Request Contact" button, "Save Profile" bookmark. |
| `ContactRequestModal` | Modal with message field. Sends a contact request to the individual (they see it in their dashboard notifications). Subject to recruiter subscription limits. |
| `SavedSearchesList` | List of saved search filter combinations with result counts. Click to re-run search. |
| `SearchPagination` | Page-based pagination (25 results per page). |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Search | `GET /api/recruiter/search?industry=&location=&min_reviews=&quality_care_min=&has_video=&page=` | GET | Filtered, paginated results |
| Profile view | `GET /api/profiles/:slug` | GET | Same as public profile |
| Contact request | `POST /api/recruiter/contact-requests` | POST | `{ profile_id, message }` |
| Save search | `POST /api/recruiter/saved-searches` | POST | `{ filters: {...} }` |
| Load saved | `GET /api/recruiter/saved-searches` | GET | List of saved searches |
| Delete saved | `DELETE /api/recruiter/saved-searches/:id` | DELETE | -- |

#### State Management

- TanStack Query keys:
  - `['recruiter', 'search', { ...filters, page }]` -- search results
  - `['recruiter', 'saved-searches']` -- saved search list
  - `['profile', slug]` -- reuse profile query from public profile
- Filters synced to URL search params for bookmarkable/shareable search URLs.
- Contact request via `useMutation` with success toast.

#### Mobile Responsiveness

- Search filters: collapsible panel at top on mobile, fixed sidebar on desktop (>=1024px).
- Results: single column card stack on mobile, 2 columns tablet, 3 columns desktop.
- Profile detail: full page on all viewports (navigate, not overlay).

#### Accessibility

- Filter controls: `<fieldset>` + `<legend>` grouping, all inputs labeled.
- Results grid: `role="list"`, profile cards as `role="listitem"`.
- Contact request modal: focus trap, `aria-modal="true"`, escape to close.
- Pagination: `aria-label="Search results pagination"`, current page `aria-current="page"`.

---

### 3.6 Subscription / Billing

| Attribute | Value |
|-----------|-------|
| **Route** | `/billing` |
| **Component** | `BillingPage` |
| **Purpose** | Display current plan, upgrade/downgrade, view billing history. Stripe integration for payment. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `CurrentPlan` | Card showing current tier (Free / Pro Individual / Employer / Recruiter), features included, renewal date (if paid), monthly cost. |
| `PlanComparison` | Side-by-side tier comparison table. Highlight current plan. "Upgrade" / "Downgrade" buttons per tier. |
| `StripeCheckout` | On upgrade: redirect to Stripe Checkout (hosted page) or embed Stripe Elements for inline payment. |
| `BillingHistory` | Table of past invoices: date, amount, status (paid/pending/failed), PDF download link. |
| `PaymentMethod` | Current payment method display (card last 4 digits). "Update payment method" button opens Stripe Customer Portal. |
| `CancelSubscription` | "Cancel subscription" link with confirmation dialog and retention messaging. |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Page load | `GET /api/billing/current` | GET | Current plan, renewal date |
| Page load | `GET /api/billing/history` | GET | Invoice list |
| Upgrade | `POST /api/billing/checkout` | POST | `{ plan_id }` -- returns Stripe checkout URL |
| Portal | `POST /api/billing/portal` | POST | Returns Stripe Customer Portal URL |
| Cancel | `POST /api/billing/cancel` | POST | -- |

#### State Management

- TanStack Query keys:
  - `['billing', 'current']` -- current plan
  - `['billing', 'history']` -- invoices
- Checkout and portal redirects are one-off (no caching needed).

#### Mobile Responsiveness

- Plan comparison: horizontal scroll on mobile, or vertically stacked cards.
- Billing history table: collapses to card view on mobile.

#### Accessibility

- Plan comparison: proper `<table>` or equivalent ARIA grid.
- Stripe Elements: Stripe handles accessibility internally.
- Cancel dialog: focus trap, `aria-modal="true"`.

---

### 3.7 Settings

| Attribute | Value |
|-----------|-------|
| **Route** | `/settings`, `/settings/profile`, `/settings/notifications`, `/settings/privacy`, `/settings/account` |
| **Component** | `SettingsLayout`, `ProfileSettings`, `NotificationSettings`, `PrivacySettings`, `AccountSettings` |
| **Purpose** | Profile editing, notification preferences, privacy controls, account management. |

#### Key UI Components

| Component | Description |
|-----------|-------------|
| `SettingsNav` | Left sidebar (desktop) or top tabs (mobile) with sections: Profile, Notifications, Privacy, Account. |
| `ProfileSettings` | Edit name, photo (upload/crop), bio, industry, role. Save button with optimistic update. |
| `NotificationSettings` | Toggle switches: email notifications for new reviews, media reviews, contact requests, weekly summary. Push notification opt-in (if PWA). |
| `PrivacySettings` | Visibility toggle (same as dashboard: Private / Recruiter-visible / Public). Data export button (JSON, PDF). "Request data deletion" link. |
| `AccountSettings` | Change email, change password, linked social accounts (Google/Apple). "Delete account" button with multi-step confirmation (type "DELETE" to confirm). |

#### API Calls

| Trigger | Endpoint | Method | Notes |
|---------|----------|--------|-------|
| Page load | `GET /api/profiles/me` | GET | Current profile data |
| Profile save | `PATCH /api/profiles/me` | PATCH | `{ name, bio, industry, role }` |
| Photo upload | `POST /api/profiles/me/photo` | POST (multipart) | Image file |
| Notification prefs | `PATCH /api/users/me/notifications` | PATCH | `{ email_reviews, email_media, email_contacts, email_weekly, push_enabled }` |
| Data export | `POST /api/profiles/me/export?format=json` | POST | Returns download URL |
| Account delete | `DELETE /api/users/me` | DELETE | Requires re-authentication |

#### State Management

- TanStack Query keys:
  - `['profile', 'me']` -- reuse profile query
  - `['user', 'me', 'notifications']` -- notification preferences
- Form state managed with React Hook Form or local `useState`.
- Mutations with `useMutation`, invalidate `['profile', 'me']` on success.

#### Mobile Responsiveness

- Settings nav: top horizontal tabs on mobile, left sidebar on desktop.
- Form fields full-width on mobile, max-width 600px on desktop.
- Toggle switches: 44px tap target height.

#### Accessibility

- Settings nav: `role="tablist"` with `role="tab"` items, `aria-selected`.
- Form inputs: associated `<label>`, `aria-required`, `aria-invalid`.
- Toggle switches: `role="switch"`, `aria-checked`.
- Delete account confirmation: `aria-describedby` linking the warning text.

---

## 4. Route Map Summary

### Review Web Routes

| Route | Component | Auth | Notes |
|-------|-----------|------|-------|
| `/r/:slug` | `ReviewLanding` | None | All review flow screens are inline on this single route (no navigation) |

### Dashboard App Routes

| Route | Component | Auth | Role |
|-------|-----------|------|------|
| `/login` | `LoginPage` | Public | -- |
| `/register` | `RegisterPage` | Public | -- |
| `/dashboard` | `IndividualDashboard` | Required | Individual |
| `/profile/:slug` | `PublicProfile` | Optional | Any (public if profile allows) |
| `/employer` | `EmployerDashboard` | Required | Employer |
| `/recruiter` | `RecruiterDashboard` | Required | Recruiter |
| `/recruiter/search` | `RecruiterSearch` | Required | Recruiter |
| `/recruiter/saved` | `SavedSearches` | Required | Recruiter |
| `/billing` | `BillingPage` | Required | Any paid role |
| `/settings` | `SettingsLayout` | Required | Any |
| `/settings/profile` | `ProfileSettings` | Required | Any |
| `/settings/notifications` | `NotificationSettings` | Required | Any |
| `/settings/privacy` | `PrivacySettings` | Required | Any |
| `/settings/account` | `AccountSettings` | Required | Any |

---

## 5. Shared UI Components (Dashboard App)

Components reused across multiple dashboard pages:

| Component | Used In | Description |
|-----------|---------|-------------|
| `QualityHeatMap` | IndividualDashboard, PublicProfile, EmployerDashboard (drill-down) | Five horizontal bars, quality name, percentage, fill proportional to value |
| `SignatureStrengthBadge` | IndividualDashboard, PublicProfile, RecruiterSearch results | "Known for [Quality]" pill with quality icon |
| `ReviewCard` | IndividualDashboard, PublicProfile | Date, quality chips, media player, verification badges |
| `AudioPlayer` | ReviewCard | Inline audio player for voice reviews. Play/pause, waveform, duration. |
| `VideoPlayer` | ReviewCard | Inline video player for video reviews. Poster frame, play/pause, fullscreen. |
| `QualityChip` | ReviewCard, RecruiterSearch filters | Small pill displaying quality name with icon |
| `VerifiedBadge` | ReviewCard, PublicProfile | "Verified Interaction" indicator |
| `AppShell` | All dashboard pages | Top nav (logo, user menu, notifications bell), side nav (role-based links), content area |
| `LoadingSkeleton` | All pages | Placeholder content matching layout while TanStack Query loads |
| `EmptyState` | All list/feed views | Illustration + message when no data (e.g., "No reviews yet") |

---

## 6. Review Landing Page -- Wireframe Description

This is the most critical screen in the product. The wireframe describes the exact layout for a 375x667px viewport (iPhone SE 3rd gen, standard mobile).

### Visual Layout (Top to Bottom)

```
+---------------------------------------+
|  8px top padding                      |
|                                       |
|  [48x48 photo]  Ramesh Kumar     [1]  |
|                 Service Advisor       |
|                 ABC Motors            |
|                 214 reviews           |
|                                       |
|  16px spacer                          |
|                                       |
|  Tap the qualities that stood out [2] |
|                                       |
|  12px spacer                          |
|                                       |
|  +----------+ +--------+ +---------+ |
|  | Expertise| |  Care  | |Delivery | [3]
|  +----------+ +--------+ +---------+ |
|  8px gap                              |
|  +------------+ +-----------+         |
|  | Initiative | |   Trust   |         |
|  +------------+ +-----------+         |
|                                       |
|  24px spacer                          |
|                                       |
|          +------------------+         |
|          |    [thumbs-up]   |   [4]   |
|          |     Submit       |         |
|          +------------------+         |
|                                       |
|  16px bottom padding                  |
+---------------------------------------+
```

### Zone Breakdown

**[1] Profile Header Zone** -- Top 25% of viewport
- Photo: 48x48px circle, left-aligned. WebP with solid color placeholder during load.
- Name: 20px bold, same line as photo, left of center.
- Org + role: 14px, muted gray (#6B7280), below name.
- Review count: 12px pill badge, muted, below org.
- Total height: approximately 80px.

**[2] Instruction Zone** -- Single line
- Text: "Tap the qualities that stood out" -- 16px, medium weight, centered.
- Color: dark gray (#374151), not black (softer feel).

**[3] Quality Chips Zone** -- Center of viewport, vertically centered
- Layout: 3-2 grid. Three chips top row, two chips bottom row (centered).
- Chip dimensions: flexible width (content + 16px horizontal padding), 44px height.
- Gap: 8px between chips.
- Unselected: 1px solid border (#D1D5DB), white background, dark text (#374151), quality icon (16x16) left of text.
- Selected: filled background (brand accent, e.g., #2563EB), white text, white icon, subtle scale-up (transform: scale(1.05), 100ms ease-out).
- Deselect: tap again, chip returns to outline state.
- Third-chip guard: if 2 chips selected and user taps a 3rd, the first-selected chip deselects with a horizontal shake animation (3 cycles, 200ms total).
- Icons: simple line icons. Expertise = lightbulb, Care = heart, Delivery = checkmark-circle, Initiative = rocket, Trust = shield.
- Order: randomized per session. Seeded by a session token embedded in the QR URL or generated on page load.

**[4] Submit Zone** -- Bottom 20% of viewport
- Button: 160px wide, 56px tall, centered horizontally.
- Style: rounded rectangle (12px radius), brand accent fill (#2563EB), white text + white thumbs-up icon (20x20).
- Label: "Submit" in 16px bold.
- Disabled state: opacity 0.4, `pointer-events: none`, `aria-disabled="true"`. Shown until at least 1 chip is selected.
- Tap behavior: immediate `POST /api/reviews`. Button morphs into a checkmark with a brief success pulse (background transitions to green #10B981, 400ms), then the view transitions to the Rich Media Prompt.

### Spacing Strategy

The entire layout uses a vertical rhythm designed so that no scrolling is needed on a 667px-tall viewport (iPhone SE). Approximate vertical budget:

| Zone | Height |
|------|--------|
| Top padding | 8px |
| Profile header | 80px |
| Spacer | 16px |
| Instruction text | 24px |
| Spacer | 12px |
| Quality chips (2 rows + gap) | 96px |
| Spacer | 24px |
| Submit button | 56px |
| Bottom padding | 16px |
| **Total** | **332px** |

This leaves 335px of free space on a 667px viewport, providing generous breathing room. On shorter viewports (568px, iPhone SE 1st gen), there is still 236px of free space -- no scrolling needed.

### Color Palette (Review Web)

| Element | Color | Usage |
|---------|-------|-------|
| Background | `#FFFFFF` | Page background |
| Primary text | `#111827` | Name |
| Secondary text | `#6B7280` | Org, role, instruction |
| Chip border (unselected) | `#D1D5DB` | Outline chips |
| Chip fill (selected) | `#2563EB` | Selected state |
| Submit button | `#2563EB` | Primary action |
| Success state | `#10B981` | Post-submit confirmation |

### Loading Behavior

1. **Instant (0ms):** HTML shell renders with placeholder layout (gray rectangles for photo, text, chips). This is cached by the service worker on repeat visits.
2. **Fast (0-500ms):** Profile data arrives via API. Photo, name, org populate with a fade-in (200ms opacity transition).
3. **Ready (<1s):** Chips become tappable. Submit button visible (disabled). Page is fully interactive.

If the API call fails or takes longer than 3 seconds, show a retry message: "Couldn't load profile. Tap to retry." with a single retry button.

---

## 7. Cross-Cutting Concerns

### Error Handling

| Scenario | Review Web | Dashboard App |
|----------|-----------|---------------|
| API failure | Inline retry message, no error page. Queue review locally if submission fails. | Toast notification with retry action. TanStack Query handles retries (3 attempts, exponential backoff). |
| Offline | Service worker serves cached shell. Review queued in IndexedDB, synced on reconnect. "Saved, will submit when online" message. | "You are offline" banner at top. Cached data displayed. Mutations queued. |
| Auth expired | N/A (no auth) | Redirect to `/login` with return URL. Firebase token refresh handled automatically. |

### Analytics Events

| Event | Frontend | Data |
|-------|----------|------|
| `qr_scan` | Review Web | slug, timestamp, device_type, referrer |
| `chip_selected` | Review Web | quality_name, display_position, total_selected |
| `review_submitted` | Review Web | qualities, time_to_submit_ms |
| `media_started` | Review Web | media_type |
| `media_completed` | Review Web | media_type, duration_ms |
| `media_skipped` | Review Web | auto_dismiss vs manual_done |
| `reference_optin` | Review Web | yes/no |
| `profile_viewed` | Dashboard | slug, viewer_role |
| `qr_downloaded` | Dashboard | format |
| `search_executed` | Dashboard | filters_applied, result_count |
| `contact_requested` | Dashboard | recruiter_id, profile_id |

### Internationalization

- Review Web: English only for MVP. Text strings externalized for future i18n.
- Dashboard App: English only for MVP. All user-facing strings in a central locale file.
- Quality names ("Expertise", "Care", etc.) are treated as brand terms -- translation strategy TBD (see PRD 02 Appendix B, open question #2).

---

## 8. Technical Constraints Summary

| Constraint | Review Web | Dashboard App |
|------------|-----------|---------------|
| Framework | Preact or vanilla JS (<20KB) | React 18+ |
| Routing | Single route, inline state transitions | TanStack Router |
| Server state | Fetch API, service worker cache | TanStack Query |
| Auth | None (OTP for verification only) | Firebase Auth |
| Bundle size | <200KB total (compressed) | No hard limit (standard SPA) |
| FCP target | <1s on 4G | <2s on broadband |
| Minimum viewport | 320px | 320px (mobile-first, desktop-optimized) |
| Browser support | Safari 15+, Chrome 90+, Samsung Internet 16+ | Same + desktop Chrome, Firefox, Safari, Edge |
| Offline support | Service worker + IndexedDB queue | Optional (nice to have) |
| Accessibility | WCAG AA | WCAG AA |
