# Mobile App — Manual Smoke Test (v0)

This is the 7-step acceptance test from `docs/specs/21-mobile-app-v0.md`. Run
it after any material change to `apps/mobile/`.

**Preconditions**

- Expo CLI available (`npx expo` works).
- A physical device with Expo Go **or** an iOS Simulator / Android emulator.
- The deployed dev API (`https://review-api.teczeed.com`) is reachable.
- If Google OAuth client IDs in `app.json extra.googleOAuth` are still
  `TODO — ...`, the login button stays disabled with a banner — that's
  expected; skip step 3's "actually sign in" part and proceed.

**Steps**

1. From `apps/mobile/`, run:
   ```
   npx expo start
   ```
2. Open the app:
   - iOS sim: press `i`. Physical iOS: scan the QR code with Expo Go.
   - Android emulator: press `a`. Physical Android: scan with Expo Go.
3. On the login screen, tap **Sign in with Google**.
   - Configured: complete the Google consent flow, then Firebase +
     `exchange-token` round-trips and lands you in `(tabs)`.
   - Not configured: button is disabled and shows the "Google OAuth not
     configured" banner. That's the expected stub state.
4. **Home tab** — confirm:
   - Profile hero (avatar, name, headline, industry chip).
   - "Total reviews" stat card shows a number (`testID="home-review-count"`).
   - If `reviewCount === 0`, the "Go to Share tab" CTA is visible.
5. **Reviews tab** — scroll the list. Reaching the bottom should load more
   pages if `total > current`. Empty state appears if there are no reviews.
6. **Share tab** — confirm QR renders at 240px, public URL appears in
   monospace underneath. Tap **Share my QR** (native share sheet opens with
   a PNG attachment where supported, otherwise with the URL as text). Tap
   **Copy link** (you should see the "Copied" alert with the URL).
7. From your terminal, open the public profile via deep link:
   ```
   xcrun simctl openurl booted reviewapp://r/sarah-williams
   # Android:
   # adb shell am start -W -a android.intent.action.VIEW -d "reviewapp://r/sarah-williams"
   ```
   The app should jump to `app/r/[slug].tsx` and show the public profile
   view. Tap **Leave a review on web** to bounce out to the web reviewer
   flow.

**Pass criteria**

- No crash at any step.
- All `testID`s are present in the accessibility tree:
  `google-signin-button`, `home-review-count`, `share-qr-image`,
  `share-qr-button`, `copy-link-button`, `public-profile-root`.
- Any API mismatch you hit goes into `docs/specs/19-mobile-api-bugs.md` as a
  new `B{n}` entry rather than a backend fix.
