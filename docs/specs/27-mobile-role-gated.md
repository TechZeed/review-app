# Spec 27 — Single Mobile App with Role-Gated Screens

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Draft
**Supersedes portions of:** Spec 20 (reviewee polish) §non-goal *"Native mobile app stays parked"* — this spec revives native scope but scopes it around role gating rather than a full rebuild.

---

## 1. Problem

The web UI now has distinct surfaces for each role: `/dashboard` (individual), `/employer`, `/recruiter`, `/admin`, `/billing`. The mobile app today (`apps/mobile`) has only the reviewee surface — profile, QR share, own-reviews feed. If an employer or recruiter logs in on mobile, they either:
- land on the reviewee dashboard (broken for non-INDIVIDUAL roles — `/profiles/me` returns 403 FORBIDDEN for admin; same class of bug likely for employer/recruiter), or
- see screens that don't apply to them.

Spec 20 (2026-04-17) explicitly parked native mobile for non-reviewee tiers, routing them to `dashboard.teczeed.com` on mobile browser. That was the right call for v0. As the product has matured (admin, employer, recruiter UIs all shipped on web), the gap on mobile is now conspicuous.

## 2. Decision (provisional — d29 on amendment)

**One mobile app, role-gated tabs.** Same bundle, same Play listing, same Expo project. The authenticated user's role determines which tabs render after login. No per-role app store listings, no separate bundles.

Rejected alternatives:
- **B. Separate apps per tier** — triples build/listing/marketing cost, forces reinstall on role change, typical only for enterprise SaaS with rigid org structures.
- **C. Keep mobile reviewee-only (spec 20 status quo)** — forces employers/recruiters into a mobile browser for tasks they'd reasonably expect to do natively (approving a team member's review, searching candidates on the train). Acceptable interim; not the long-term answer.

## 3. Scope

### In scope (v1 — this spec)
- **Email+password sign-in on mobile** (flag `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true`, wired into `deploy-mobile.yml` env 2026-04-19).
- **Role-driven root tab bar** (expo-router Drawer or Tabs).
- **Individual tab stack** (existing screens) — Home, Profile, QR share, Reviews, Settings.
- **Admin tab stack** — "Approvals" (role requests) + "Users" (list).
- **Deny-landing** for role whose screen isn't built yet — "Open in browser" card with a deep-link to `review-dashboard.teczeed.com`.

### In scope (v1.1)
- **Employer tab stack** — References inbox preview + Team list.
- **Recruiter tab stack** — Search + Candidate detail.

### Out of scope (v2+)
- Stripe Checkout inside the app (opens via WebView → browser fallback, same as web).
- Admin ban / impersonate flows.
- Push notifications per role.
- Offline cache per role.

## 4. Information architecture

Post-login, the user's `role` drives the tab set:

| Role | Tabs (left-to-right) |
|---|---|
| `INDIVIDUAL` | Home · Profile · Reviews · Share QR · Settings |
| `EMPLOYER` | Dashboard · Team · References · Settings |
| `RECRUITER` | Search · Saved · Contact · Settings |
| `ADMIN` | Approvals · Users · Settings |

A single **Settings** tab is always present (account, sign out, open billing in browser, legal, about).

### 4.1 Expo-router structure

```
apps/mobile/app/
  (auth)/
    login.tsx                ← existing, now with email+password flag wired
  (tabs)/
    _layout.tsx              ← NEW — reads auth.role, mounts role-specific tab array
    index.tsx                ← role-dispatched landing (dynamic import)
    individual/
      _layout.tsx
      index.tsx              ← "Home"
      profile.tsx
      reviews.tsx
      share.tsx
      settings.tsx
    admin/
      _layout.tsx
      approvals.tsx          ← role-requests list + approve/reject
      users.tsx
      settings.tsx
    employer/                ← v1.1
      _layout.tsx
      dashboard.tsx
      team.tsx
      references.tsx
      settings.tsx
    recruiter/               ← v1.1
      _layout.tsx
      search.tsx
      saved.tsx
      contact.tsx
      settings.tsx
  index.tsx                  ← auth redirect (existing)
```

`_layout.tsx` at `(tabs)` inspects the store's role and returns the corresponding tab stack. Unknown / unauthed → bounce to `(auth)/login`.

### 4.2 Shared components

- `RoleBadge` — tiny colored pill in the header for every screen.
- `OpenInBrowserCard` — uniform "this action lives in the browser" affordance used when a mobile screen is not yet implemented for a role (e.g., employer billing → opens Stripe Checkout in system browser).
- `ApiError` — same envelope as web's error banners; resilient to the API's `{error, code, traceId}` shape.

## 5. Auth flow recap

1. User opens app → `index.tsx` checks `expo-secure-store` for `auth_user`.
2. Present → `(tabs)` layout mounts; role-dispatched.
3. Absent → `(auth)/login` with two affordances:
   - Google (via `@react-native-google-signin/google-signin`, existing).
   - Email + password (gated by `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true`, fixed 2026-04-19).
4. After successful login, `auth_user` is written to secure storage; router navigates to `(tabs)`.
5. Sign-out clears storage and returns to `(auth)/login`.

**Invariant**: the mobile app never stores the password, only the JWT returned by `POST /api/v1/auth/login`.

## 6. Deny-landing — graceful degradation

For v1, only INDIVIDUAL and ADMIN tab stacks are fully built. EMPLOYER and RECRUITER will land on a single-screen **Coming-soon** view with:

- A short explainer ("The employer toolkit is available on the web today").
- `<OpenInBrowserCard>` that opens `https://review-dashboard.teczeed.com/employer` (deep link pre-filled with the user's auth token via `?authHint=...` query — **NOT** the JWT itself, just a flag so the web knows to show the sign-in modal with the email pre-populated).
- Sign out.

This keeps the app installable for all roles on day 1, no broken "blank dashboard" experience, while v1.1 fills in the native screens.

## 7. App-icon and splash

Branded placeholder committed 2026-04-19:

- `assets/icon.png` — 1024×1024 white "R" monogram on indigo `#4f46e5`.
- `assets/adaptive-icon.png` — 1024×1024 transparent foreground (Android adaptive icon; system adds the indigo background).
- `assets/splash-icon.png` — 600×600 indigo "R" on transparent (splash background color is the same indigo, set in `app.json`).
- `assets/favicon.png` — 48×48 web build.

**Rotation plan**: replace all four with a designer-made wordmark + QR mark before opening Play Store external testing. Same file paths, no code changes.

## 8. Play Store listing

The AAB pipeline is green; the public listing is not. Before promoting from Internal Testing to Closed/Open Testing, Play Console → Main store listing needs:

- **Title**: `ReviewApp` (or brand final).
- **Short description** (80 chars).
- **Full description** (up to 4000 chars).
- **App icon** (512×512, derived from `icon.png`).
- **Feature graphic** (1024×500).
- **Screenshots**: ≥2 per surface (phone, 7" tablet optional).
- **Privacy policy URL** — must be live and reachable (Play rejects otherwise).
- **Category**: *Business* or *Productivity*.
- **Content rating**: complete the IARC questionnaire.

**Automation**: `eas metadata` can manage all of the above declaratively from `apps/mobile/store.config.json`. Not wired in v1; listing can stay manual until we move off Internal Testing.

## 9. Environment

Build-time vars that must be present when `eas build` runs (passed through `deploy-mobile.yml` env or baked into `.env.dev` + loaded by the workflow):

- `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true` — enables email+password on the login screen. **Fixed 2026-04-19** in `deploy-mobile.yml`.
- `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_WEB_URL`, `EXPO_PUBLIC_DASHBOARD_URL` — route the app at the right backend.
- Existing Firebase + Google OAuth client IDs (already in `app.json.extra`).

## 10. Rollout

1. **v1 — this spec**: email flag + icons + role-dispatched tabs for INDIVIDUAL and ADMIN. Deny-landing for EMPLOYER and RECRUITER. Ship as Internal Testing build.
2. **v1.1 — follow-up spec**: EMPLOYER tab stack (dashboard, team, references preview) + RECRUITER tab stack (search, contact). Remove their deny-landings.
3. **v1.2**: metadata automation via `eas metadata` + first public listing promotion.

Each step ships via `gh workflow run deploy-mobile.yml -f profile=production -f submit=true`, goes to Play Internal draft, testers install.

## 11. Invariants

- Single AAB / IPA. One Play Console listing. One App Store Connect app.
- `role` drives tab visibility, nothing else. Screens never read `user.tier` to branch IA — tier only gates individual actions inside a screen (e.g., "Upgrade to Pro" button for FREE tier on the individual Profile).
- Any screen not yet implemented for a role returns the `OpenInBrowserCard` — never a blank component, never a 403 surfaced as an error.
- `EXPO_PUBLIC_*` env is build-time; post-deploy changes require a rebuild. Any flag that needs to flip at runtime goes through a server-side config endpoint (out of scope for v1).

## 12. Known gaps / follow-ups

- `POST /api/v1/profiles/me` returns 403 for non-INDIVIDUAL. The mobile `/home` landing for EMPLOYER/RECRUITER must never call this endpoint; role-dispatch at the tab layer handles that in v1. A proper fix (typed role-aware endpoint, e.g., `/me` returning a role-discriminated union) is a server-side follow-up.
- No push notifications yet. Role-specific notifications (role-request submitted → ping admin, review received → ping individual) are out of scope for v1.
