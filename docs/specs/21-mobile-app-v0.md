# Spec 21 — Mobile App v0 (Reviewee Daily Loop, Native Expo)

**Decision reference.** Ties to huddle decision **d18** (2026-04-17): unpark `apps/mobile` and build the native Reviewee daily loop. PWA in `apps/ui` stays as-is; native complements it.

**Rule (inherited from spec 19).** Assume API contracts are correct. If any endpoint or field is wrong/missing, append to `docs/specs/19-mobile-api-bugs.md` and proceed with a client-side workaround. Do **not** modify the API in this spec's work.

**Goal.** Sarah the nurse installs the app from (eventually) Play/App Store, signs in with Google, sees her latest review count, scrolls her reviews feed, taps Share-my-QR, sends it to a friend. End-to-end in one evening of focused work.

**Non-goals (v0).**
- No review submission / QR scanner (Reviewers stay on `apps/web`).
- No admin, no role-request approval, no Stripe flows.
- No Employer/Recruiter screens.
- No push notifications.
- No offline cache / background sync.
- No search.
- No universal links (`teczeed.com/r/:slug` → app). Custom scheme only (`reviewapp://`). Universal links added in a later spec with domain-hosted `apple-app-site-association` + `assetlinks.json`.

---

## Assumed API contracts

All endpoints under `${VITE_API_URL}`, read from `Constants.expoConfig.extra.apiUrl`. For v0, the app talks to the **deployed dev API** (`https://review-api.teczeed.com`), not localhost — a device can't reach the Mac's localhost directly.

| Flow | Method + Path | Request | Response shape (assumed) |
|---|---|---|---|
| Google token exchange | `POST /api/v1/auth/exchange-token` | `{ firebaseIdToken: string }` | `{ token: string, user: { id, email, name, role } }` |
| My profile | `GET /api/v1/profiles/me` | Bearer JWT | `{ id, slug, name, headline, industry, reviewCount, qualityBreakdown, … }` |
| Public profile | `GET /api/v1/profiles/:slug` | — | same shape as `/me` |
| My reviews | `GET /api/v1/reviews/profile/:profileId?page=1&limit=20` | Bearer JWT | `{ reviews: Review[], total, page, limit }` |

If any of these don't behave, log in spec 19 as B3, B4, etc.

---

## Dependencies to add

Install in `apps/mobile/package.json`:

| Package | Purpose |
|---|---|
| `expo-router` | File-based routing, typed links, deep-linking |
| `@tanstack/react-query` | Same server state pattern as `apps/ui` |
| `expo-auth-session` | Google sign-in without native module setup |
| `expo-web-browser` | Required by `expo-auth-session` |
| `expo-crypto` | PKCE for auth-session |
| `expo-secure-store` | Persist JWT securely |
| `expo-constants` | Read `extra.apiUrl` |
| `expo-sharing` | Native share sheet |
| `expo-file-system` | Write QR PNG to tmp for sharing |
| `react-native-qrcode-svg` | QR rendering |
| `react-native-svg` | Required by QR lib |
| `firebase` (JS SDK) | Build credential from Google ID token |

Install via: `cd apps/mobile && npx expo install <list>`

---

## Folder structure (Expo Router)

```
apps/mobile/
  app.json              — add scheme, plugins, deep-link config
  package.json          — deps above
  App.tsx               — DELETE (replaced by Expo Router entry)
  index.ts              — updated to `import "expo-router/entry";`
  app/                  — routes (file-based)
    _layout.tsx         — Root layout. QueryClientProvider, AuthProvider.
    (auth)/
      _layout.tsx
      login.tsx         — Google sign-in button, navigates to (tabs)/ on success
    (tabs)/
      _layout.tsx       — Tabs: Home | Reviews | Share
      index.tsx         — Home (my profile hero + today's review count)
      reviews.tsx       — My reviews feed
      share.tsx         — QR + share button
    r/
      [slug].tsx        — Public profile view (deep-link target)
  lib/
    api.ts              — Typed fetch client, reads VITE_API_URL, injects JWT
    auth.ts             — Google sign-in via expo-auth-session, exchange, persist
    storage.ts          — expo-secure-store wrapper
    env.ts              — Reads Constants.expoConfig.extra.apiUrl and extra.webUrl
    queryClient.ts      — React Query client
  context/
    AuthContext.tsx     — { user, token, signIn, signOut, isLoading }
  components/
    ProfileHero.tsx
    ReviewCard.tsx
    QRCard.tsx          — QR + encoded URL text
    ShareQRButton.tsx   — expo-sharing share of rendered QR PNG
    Screen.tsx          — SafeAreaView wrapper with consistent padding
  assets/               — existing icons kept
```

Remove `App.tsx` (boilerplate). Entry point becomes `expo-router/entry`.

---

## `app.json` changes

```json
{
  "expo": {
    "scheme": "reviewapp",
    "plugins": [
      "expo-router",
      "expo-secure-store"
    ],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "sg.reviewapp.app",
      "infoPlist": {
        "LSApplicationQueriesSchemes": ["mailto", "sms", "tel"]
      }
    },
    "android": {
      "package": "sg.reviewapp.app",
      "edgeToEdgeEnabled": true,
      "versionCode": 4,
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": false,
          "data": [{ "scheme": "reviewapp" }],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    },
    "extra": {
      "apiUrl": "https://review-api.teczeed.com",
      "webUrl": "https://review-scan.teczeed.com",
      "dashboardUrl": "https://review-dashboard.teczeed.com",
      "firebase": {
        "apiKey": "AIzaSyBAQ3fKCEiCn-z7VPG9jEzQ-XA9rCWBvhE",
        "authDomain": "humini-review.firebaseapp.com",
        "projectId": "humini-review",
        "messagingSenderId": "1049089489429",
        "appId": "1:1049089489429:web:5f0ab182785d1cf3f22c1c"
      },
      "googleOAuth": {
        "webClientId": "TODO — copy from Firebase → Project settings → SDK setup (Web)",
        "iosClientId": "TODO — Firebase → iOS app (add iOS app first)",
        "androidClientId": "TODO — Firebase → Android app (add Android app first)"
      },
      "eas": {
        "projectId": "0a16994f-a788-4021-bd41-ad1afed8da3f"
      }
    }
  }
}
```

### Google OAuth client IDs — required prerequisite

`expo-auth-session` needs Google OAuth client IDs. Until these exist, Google sign-in is a stub that logs a "not configured" message. Log this in spec 19 as a non-bug blocker note.

Steps (manual, for Muthukumaran to do in Firebase Console before real auth works):
1. Firebase Console → `humini-review` → Project settings → General → Add app → iOS → bundle `sg.reviewapp.app` → download `GoogleService-Info.plist` (not used by JS SDK but required to register the client ID).
2. Add Android app → package `sg.reviewapp.app` → SHA-1 fingerprint from EAS credentials → download `google-services.json` (same note).
3. Copy the three OAuth client IDs (Web, iOS, Android) from Firebase → Authentication → Sign-in method → Google → Web SDK configuration.
4. Paste into `app.json extra.googleOAuth`.

---

## Screens — acceptance per screen

### `app/(auth)/login.tsx`
- Centred card, "Sign in with Google" button, app logo above.
- Tapping button → `expo-auth-session` Google flow → receives ID token → `signInWithCredential(GoogleAuthProvider.credential(idToken))` → get Firebase ID token → `POST /auth/exchange-token` → store JWT in SecureStore → navigate to `(tabs)`.
- Error toast on failure.
- If `googleOAuth.webClientId` is `"TODO …"`: show "Google OAuth not configured — ask Muthu to wire client IDs" and skip the flow (do NOT crash).

### `app/(tabs)/index.tsx` — Home
- Shows logged-in user's name, headline, review count, small quality summary (top 2 qualities as chips).
- Data: `GET /profiles/me`.
- Pull-to-refresh.
- Empty state if `reviewCount === 0`: "No reviews yet. Tap Share to get your QR out there."

### `app/(tabs)/reviews.tsx` — My reviews
- FlatList of `ReviewCard`s. Infinite scroll when `total > current count`. Start with `limit=20, page=1`.
- Data: `GET /reviews/profile/:profileId` using `me.id`.
- Each card: quality chips, thumbs up icon, text snippet, relative time.

### `app/(tabs)/share.tsx` — Share QR
- QR centred, white background card, rounded corners.
- Text below: the public URL (`${webUrl}/r/${slug}`).
- **Share my QR** button — renders QR SVG → PNG via `react-native-view-shot` **OR** use QR lib's `getDataURL` → save to `FileSystem.cacheDirectory` → `Sharing.shareAsync(uri)`.
- **Copy link** button — `Clipboard.setStringAsync(publicUrl)` + toast.

### `app/r/[slug].tsx` — Public profile (deep-link target)
- Entered via `reviewapp://r/sarah-williams` or in-app navigation.
- No auth required.
- Shows public profile fields, qualities, review count. No reviews list (Reviewer flow stays on web for v0).
- Single CTA: "Leave a review on web" → `Linking.openURL(`${webUrl}/r/${slug}`)`. Native review submission is NOT in v0.

---

## Auth flow — concrete

```
LoginScreen
  └─ expo-auth-session useAuthRequest({ clientId: webClientId, scopes: ['profile','email'] })
  └─ Google returns { authentication: { idToken } }
  └─ Firebase Web SDK: const cred = GoogleAuthProvider.credential(idToken)
  └─ signInWithCredential(auth, cred) → user
  └─ user.getIdToken() → firebaseIdToken
  └─ POST /api/v1/auth/exchange-token { firebaseIdToken } → { token, user }
  └─ SecureStore.setItemAsync('token', token)
  └─ setUser(user) in AuthContext
  └─ router.replace('/(tabs)')
```

On app startup, `AuthContext` reads `token` from SecureStore. If present, assumes valid (optimistic). A 401 from any API call triggers `signOut()` → back to login.

---

## Deep links

- Scheme: `reviewapp://`
- Routes handled by Expo Router automatically from file structure:
  - `reviewapp://r/sarah-williams` → `app/r/[slug].tsx`
  - `reviewapp://` → `app/(tabs)/index.tsx` (default)
- Test: `xcrun simctl openurl booted reviewapp://r/sarah-williams` on iOS sim, `adb shell am start -W -a android.intent.action.VIEW -d "reviewapp://r/sarah-williams"` on Android.

---

## Env / config surface

The app reads only from `Constants.expoConfig.extra.*`. No `.env` file in `apps/mobile`. For dev vs prod, use `eas.json` profiles to inject different `extra` values later — out of scope for v0.

---

## Testability

- Every interactive element gets an `accessibilityLabel` and a `testID`:
  - `testID="google-signin-button"`
  - `testID="home-review-count"`
  - `testID="share-qr-image"`, `testID="share-qr-button"`, `testID="copy-link-button"`
  - `testID="public-profile-root"` on `r/[slug]`
- Manual smoke test script (in the spec) the agent writes to `apps/mobile/SMOKE.md`:
  1. `cd apps/mobile && npx expo start`
  2. Open Expo Go on phone OR iOS simulator.
  3. Tap sign-in (stubbed if Google not configured).
  4. Home → see review count.
  5. Reviews tab → scroll.
  6. Share tab → see QR → tap Share.
  7. From terminal: `xcrun simctl openurl booted reviewapp://r/sarah-williams` → app opens on public profile.

---

## Order of execution for agents

**Agent M1 — Scaffold** (no screens, just foundation):
- Install deps.
- Rewrite `app.json` per spec.
- Delete `App.tsx`; update `index.ts` to Expo Router entry.
- Create `lib/`, `context/`, `components/Screen.tsx`.
- Create `app/_layout.tsx` with QueryClientProvider + AuthProvider.
- Create `app/(auth)/_layout.tsx` and `app/(tabs)/_layout.tsx` (tabs scaffold, stub screens).
- Run `npx expo prebuild --clean` is NOT required for Expo Go usage. Just `npx expo start --tunnel` must not crash. Agent must NOT run start; just verify `npx tsc --noEmit` clean.

**Agent M2 — Screens** (runs after M1 completes):
- Implement `login.tsx`, `index.tsx`, `reviews.tsx`, `share.tsx`, `r/[slug].tsx`.
- Implement `auth.ts`, `api.ts`, QR rendering, share flow.
- Write `apps/mobile/SMOKE.md`.
- `npx tsc --noEmit` clean.

---

## Success criteria

- [ ] `apps/mobile` builds — `npx tsc --noEmit` passes with no errors.
- [ ] App launches (Expo Go or sim) and renders login screen without crash.
- [ ] Deep link `reviewapp://r/:slug` opens public profile screen.
- [ ] If Google OAuth IDs configured: sign-in → home → reviews all work against deployed dev API.
- [ ] If Google OAuth IDs NOT configured: screens render, login shows "not configured" banner, no crash.
- [ ] Any API mismatch surfaced while building → appended to spec 19.
- [ ] `SMOKE.md` exists with the manual 7-step test.
