# Spec 19 — Mobile API Bugs & Gaps Tracker

**Purpose.** While building the mobile app we will hit server-side bugs, missing endpoints, or contract mismatches. This spec is the parking lot for all of them so mobile work doesn't get derailed into backend fixes. Each entry gets picked up in a later API sprint.

**Rule.** When building the mobile app, if the API is wrong:
1. Do **not** fix the API in that session.
2. Add an entry here with repro + current behaviour + expected behaviour.
3. If the mobile flow can proceed with a local workaround (stub, client-side fake), do so and note the workaround.
4. Continue mobile work.

**Status legend:** `open` = not fixed · `workaround` = mobile proceeding with client-side hack · `fixed` = resolved, entry kept for history.

---

## Entries

### B1 — `POST /api/v1/reviews/scan/:slug` rejects request without `deviceFingerprint`

- **Status:** open
- **Discovered:** 2026-04-17 via `apps/web` review flow
- **Repro:** Scan `/r/sarah-williams` on web, click Submit after selecting 2 qualities.
- **Request:** `POST /api/v1/reviews/scan/sarah-williams` with body `{ qualityIds: [...], thumbsUp: true }`
- **Current:** 400 `Validation failed: [{"field":"deviceFingerprint","message":"Device fingerprint is required"}]`
- **Expected:** Either (a) endpoint accepts request without fingerprint and derives server-side from UA + IP, or (b) the client must send it and this must be documented.
- **Impact on mobile:** Mobile also needs to send `deviceFingerprint`. Mobile fingerprint shape is different from web — need a documented schema.
- **Workaround for mobile:** Build a mobile fingerprint util mirroring `apps/web` (whatever it sends, once web is fixed). Send `{ platform: "ios"|"android", deviceId: expo Constants.installationId, locale, timezone }` as a stub.
- **Fix location (for later API sprint):** `apps/api/src/modules/reviews/reviews.validation.ts` + controller/service layer.

---

### B2 — `GET /api/v1/profiles/:slug` returns headline as `name`

- **Status:** open
- **Discovered:** 2026-04-17 via `apps/ui` local run against Sarah's seeded profile
- **Repro:** `curl http://localhost:3000/api/v1/profiles/sarah-williams`
- **Request:** `GET /api/v1/profiles/sarah-williams`
- **Current:** Response has `"name":"Registered Nurse"` — that's the **headline**, not the person's name.
- **Expected:** `name` should be the user's actual full name (e.g. "Sarah Williams"). Headline should be a separate field (`headline`). The profile card on web/ui displays this as the hero text — currently showing job title instead of the person.
- **Impact on mobile:** Same — mobile profile screens will show "Registered Nurse" instead of "Sarah Williams".
- **Workaround:** None — this is display-critical. Frontend could read `slug` and title-case it as a temp fallback, but that's ugly.
- **Fix location:** `apps/api/src/modules/profiles/profiles.service.ts` (or wherever the profile DTO is built) — join to `users.name` and expose as `name`, keep `headline` as separate field.

---

### B3 — `POST /api/v1/auth/exchange-token` expects `firebaseToken`, spec 21 says `firebaseIdToken`

- **Status:** workaround
- **Discovered:** 2026-04-17 via `apps/mobile` auth wiring
- **Repro:** Post to `/api/v1/auth/exchange-token` with `{ firebaseIdToken: "..." }` — fails validation.
- **Request:** `POST /api/v1/auth/exchange-token` body `{ firebaseIdToken: string }`
- **Current:** 400 `Validation failed: firebaseToken is required`. Source of truth is `apps/api/src/modules/auth/auth.validation.ts#exchangeFirebaseTokenSchema` which expects the field name `firebaseToken`.
- **Expected:** Either the API should also accept `firebaseIdToken` (alias), or spec 21 should be updated. The name `firebaseIdToken` is more precise (it is the Firebase ID token, not an OAuth access token) so renaming the API field to `firebaseIdToken` is the cleaner fix.
- **Impact on mobile:** Mobile cannot exchange tokens if it follows spec 21 literally.
- **Workaround for mobile:** `apps/mobile/lib/api.ts#exchangeToken` sends the body as `{ firebaseToken }` to match what the API expects today. Field renamed on client only; Firebase ID token semantics unchanged.
- **Fix location:** `apps/api/src/modules/auth/auth.validation.ts` (rename schema key to `firebaseIdToken`) and `apps/api/src/modules/auth/auth.controller.ts#exchangeToken` (rename `req.body.firebaseToken`).

---

### B4 — `GET /api/v1/profiles/me` does not return `qualityBreakdown`

- **Status:** workaround
- **Discovered:** 2026-04-17 via `apps/mobile` Home screen wiring
- **Repro:** Authenticated `curl /api/v1/profiles/me`.
- **Request:** `GET /api/v1/profiles/me` with Bearer JWT.
- **Current:** `ProfileService.toResponse` returns `{ id, slug, name, industry, bio, visibility, qrCodeUrl, profileUrl, reviewCount, ... }`. **No `qualityBreakdown`**. Only `toPublicResponse` (used by `/profiles/:slug`) exposes it.
- **Expected:** `/profiles/me` should also include `qualityBreakdown` (or at least a link to `/profiles/me/stats` which already computes it). Spec 21's assumed shape for `/me` includes `qualityBreakdown`.
- **Impact on mobile:** Mobile Home "top 2 qualities as chips" cannot be derived directly from `/me`.
- **Workaround for mobile:** Home screen calls `/profiles/me` for identity, and after it loads also calls `/profiles/${slug}` (public route) to get `qualityBreakdown`. Two round-trips instead of one. Cached by React Query.
- **Fix location:** `apps/api/src/modules/profile/profile.service.ts#toResponse` — include the same `qualityBreakdown` block computed in `toPublicResponse` / `getQualityStats`.

---

## Template for new entries

```markdown
### B{n} — {one-line summary}

- **Status:** open | workaround | fixed
- **Discovered:** {YYYY-MM-DD} via {where in mobile}
- **Repro:** {steps}
- **Request:** {method + path + body}
- **Current:** {actual response or behaviour}
- **Expected:** {what should happen}
- **Impact on mobile:** {what mobile flow is blocked or degraded}
- **Workaround for mobile:** {none | describe}
- **Fix location:** {file paths where API should change}
```

---

## Missing / undocumented endpoints (for mobile)

Endpoints mobile will need that we have **not yet confirmed exist** on the API. Each gets a row once we try to wire it up in mobile and discover what the API actually returns. Leave blank until confirmed.

| Mobile flow | Endpoint assumed | Confirmed? | Notes |
|---|---|---|---|
| Scan QR → load profile | `GET /api/v1/profiles/:slug` | ✅ (used by web) | |
| Start review session | `POST /api/v1/reviews/scan/:slug` | ⚠️ exists but buggy (B1) | |
| OTP send / verify | `POST /api/v1/otp/send`, `POST /api/v1/otp/verify` | ✅ (used by web) | |
| Submit review | `POST /api/v1/reviews/submit` | ✅ (used by web) | |
| Attach media | `POST /api/v1/reviews/:reviewId/media` | ✅ (used by web) | |
| Google sign-in exchange | `POST /api/v1/auth/exchange-token` | ✅ (used by ui) | |
| My profile | `GET /api/v1/profiles/me` | ✅ (used by ui) | |
| My received reviews | `GET /api/v1/reviews/profile/:profileId?page=1&limit=20` | ✅ (used by ui) | |
| **Search people** (name / industry) | `GET /api/v1/profiles/search?q=...` | ❓ unverified | needed for mobile search screen |
| **Grant reference access** (verifiable references opt-in) | `POST /api/v1/references/grant` or similar | ❓ unverified | d6 decision — no UI exists yet |
| **List people I've reviewed** (customer-side history) | ❓ | ❓ | needed if we show "your reviews" on mobile |

---

## Companion scope note

This spec is **bug-log only**. API fixes happen in a dedicated API sprint after the mobile UI is usable end-to-end against real endpoints (with workarounds where needed). Do not open PRs that mix mobile work with API fixes from this list.
