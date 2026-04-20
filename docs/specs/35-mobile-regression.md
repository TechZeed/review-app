# Spec 35 — Mobile App Regression (Maestro on Device)

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-20
**Status:** Draft (sibling of spec 25 — pairs the web E2E suite with a native-device suite)
**Related:** Spec 21 (mobile app v0 — reviewee native scope), Spec 25 (web regression), Spec 28 (capability-based access), d18 (2026-04-17 — native reviewee unpark), earlier huddle (2026-04-19 — Maestro + physical device chosen over emulator).

---

## 1. Problem

Spec 25's Playwright suite covers web + dashboard + public profile against deployed dev, but **cannot drive the Expo native app**. Native modules (`expo-secure-store`, `expo-camera`, `@react-native-google-signin/google-signin`, react-native Firebase SDK) don't exist in a Chromium context. `expo web` strips or stubs those modules — running Playwright against the web target would test a degraded build that isn't what Play Store ships.

Today we have `01-mobile-api.spec.ts` which exercises the **API** the mobile app hits (mobile-shaped payloads, profile/me contract, scan endpoint with deviceFingerprint). That catches API regressions. It doesn't catch:

- The app not launching after an APK install (runtime crashes, missing native module wiring).
- The email+password affordance being hidden by a mis-baked `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN` flag (the bug we fixed 2026-04-19).
- Login completing but the dashboard failing to render ramesh's profile.
- QR share triggering the native share sheet without throwing.
- Review list pagination / scroll on a real device viewport.

A UI-level native suite is the only thing that catches those.

## 2. Goals

- Same "is dev shippable on mobile" signal that spec 25 provides for web — red means a Play Internal promote is blocked.
- Runs against the **dev-deployed API** (`https://review-api.teczeed.com`) using the **Play Internal APK** installed on a physical Android device over ADB.
- Covers the 5 critical reviewee journeys (§5) in <5 min total wall-clock.
- Authored in YAML, not JS — Maestro is the driver, not Detox.
- No new monorepo dependencies on the CI side until we stabilize locally.

## 3. Non-goals (v1)

- **No iOS.** Spec 17 documents iOS as "wired, first-run cert bootstrap pending". Until that unblocks, iOS is parked. When it unblocks, spec 35.1 extends this with Maestro for iOS Simulator or real device.
- **No emulator.** Per the earlier huddle (2026-04-19), user chose **physical device + Maestro** over Android emulator. Emulator support added later if CI integration demands it.
- **No employer/recruiter/admin mobile.** Per d18 / spec 21, native mobile = reviewee only. Those tiers stay on web (dashboard.teczeed.com PWA).
- **No push-notification / deep-link tests.** Those need Firebase + OS-level plumbing. Later spec.
- **No CI integration in v1.** Local developer tool. When we're ready for CI, we revisit emulator + GH Actions Android runner.

## 4. Architecture

### 4.1 Driver

**Maestro** — YAML-defined flows, runs against any Android device reachable via ADB. Chosen over Detox because:
- YAML is review-friendly; Detox's JS-in-test-context is harder to read in PRs.
- Maestro supports physical devices out-of-the-box with zero Android Studio scaffolding.
- Flows are declarative — no React Native internals leak into the test.

### 4.2 Target

- **Dev APK**: installed via `adb install preview.apk` — the same `preview.apk` asset GitHub Releases stores under `mobile-preview-<timestamp>` tags (spec 17 §deploy-mobile.yml preview profile). No Play Console dependency.
- **Dev API**: `https://review-api.teczeed.com` — the APK ships with this URL baked in via `EXPO_PUBLIC_API_URL` at build time.
- **Seeded demo account**: `ramesh@reviewapp.demo` / `Demo123` (spec 04) — email+password path enabled in dev APKs per the `EXPO_PUBLIC_FEATURE_EMAIL_LOGIN=true` build-time var (spec 17 §deploy-mobile.yml).

### 4.3 Run-time dependencies

Installed once on the developer's Mac:

- **Android SDK platform-tools** (ADB) — already present (verified earlier at `/Users/muthuishere/Library/Android/sdk/platform-tools/adb`).
- **Maestro CLI** — `curl -Ls "https://get.maestro.mobile.dev" | bash`. Adds `~/.maestro/bin` to PATH.
- **A physical Android device** with USB debugging enabled, connected via USB, and authorised to the Mac.

## 5. Flow catalogue

Five flows cover the reviewee daily loop (spec 21 §goal: *"Sarah the nurse installs the app, signs in, sees her reviews, taps Share-my-QR"*).

### 5.1 `01-launch.yaml` — cold start + email login

```yaml
appId: sg.reviewapp.app
---
- launchApp:
    clearState: true
- assertVisible: "Continue with Google"
- assertVisible: "Sign in with email and password"
- tapOn: "Sign in with email and password"
- assertVisible: "Email"
- inputText: "ramesh@reviewapp.demo"
- tapOn: "Password"
- inputText: "Demo123"
- tapOn: "Sign in"
- assertVisible:
    text: "Ramesh"
    timeout: 15000
```

Catches: app won't launch, email affordance hidden (the 2026-04-19 fix), login failing, post-login dashboard not reaching the user's name.

### 5.2 `02-reviews-list.yaml` — reviewee sees their reviews

```yaml
appId: sg.reviewapp.app
---
- launchApp
- tapOn: "Reviews"
- assertVisible:
    text: "expertise"
    timeout: 10000
- scrollUntilVisible:
    element:
      text: "care"
- assertVisible: "care"
```

Catches: reviews list not rendering, pagination broken, quality chips missing. Ramesh has 150 seeded reviews covering all 5 qualities; scroll-to-match exercises virtualization.

### 5.3 `03-share-qr.yaml` — QR share via native share sheet

```yaml
appId: sg.reviewapp.app
---
- launchApp
- tapOn: "Share"
- assertVisible:
    id: "reviewee-qr"
    timeout: 5000
- tapOn:
    id: "share-qr-button"
- # Native share sheet opens — Maestro cannot assert its contents,
  # but can detect we're no longer on the Share tab.
- waitForAnimationToEnd
- pressKey: "Back"
- assertVisible: "Share"
```

Catches: QR doesn't render, share button throws, share sheet never opens.

### 5.4 `04-profile-header.yaml` — profile header rendering

```yaml
appId: sg.reviewapp.app
---
- launchApp
- tapOn: "Home"
- assertVisible: "Ramesh"
- assertVisible: "Senior Sales Consultant"  # headline from seed
- assertVisible:
    text: "150"   # reviewCount badge
    timeout: 5000
```

Catches: `/profiles/me` contract drift (spec 19 mobile API gaps). Fails loud when the backend renames a field.

### 5.5 `05-logout.yaml` — sign out returns to login

```yaml
appId: sg.reviewapp.app
---
- launchApp
- tapOn: "Settings"
- tapOn: "Sign out"
- assertVisible: "Continue with Google"
- assertVisible: "Sign in with email and password"
```

Catches: logout doesn't clear session, or settings screen broken.

## 6. Directory layout

```
apps/regression/
  maestro/
    01-launch.yaml
    02-reviews-list.yaml
    03-share-qr.yaml
    04-profile-header.yaml
    05-logout.yaml
    config.yaml          # shared Maestro config (appId, timeouts)
```

Sits under the existing `apps/regression/` workspace — co-located with the Playwright specs so "the regression suite" is one directory. YAML is Maestro-native; no bun/tsx required.

## 7. Task wiring

`Taskfile.dev.yml` new section:

```yaml
# ─── Mobile regression ───────────────────────────────────────────────────────

test:regression:mobile:
  desc: Run Maestro flows against a connected Android device (spec 35)
  dir: "{{.REPO_ROOT}}/apps/regression/maestro"
  cmd: maestro test .

test:regression:mobile:flow:
  desc: Run a single flow, e.g. `task dev:test:regression:mobile:flow -- 01-launch.yaml`
  dir: "{{.REPO_ROOT}}/apps/regression/maestro"
  cmd: maestro test {{.CLI_ARGS}}

test:regression:mobile:install:
  desc: Install the latest preview APK from GitHub Releases onto the connected device
  cmd: |
    mkdir -p /tmp/reviewapp-regression
    TAG=$(gh release list --limit 10 --json tagName,createdAt --jq '[.[] | select(.tagName | startswith("mobile-preview-"))] | sort_by(.createdAt) | reverse | .[0].tagName')
    echo "Installing preview APK from $TAG"
    gh release download "$TAG" --pattern preview.apk --dir /tmp/reviewapp-regression --clobber
    adb install -r /tmp/reviewapp-regression/preview.apk
```

Developer workflow:

```bash
# One-time per device / after a breaking APK change:
task dev:test:regression:mobile:install

# Every regression run:
task dev:test:regression:mobile
```

## 8. Gaps this surfaces

Maestro's `assertVisible` with text matching will fail **loud** when the mobile UI diverges from what this spec assumes. Expected findings on first run:

- `02-reviews-list.yaml` — if the Reviews tab isn't labeled exactly "Reviews", or the quality chips render differently than the web (e.g. capitalized), the selectors need tuning. Document in the flow comment.
- `04-profile-header.yaml` — if `/profiles/me` doesn't return `reviewCount: 150` for ramesh (spec 19 open gap: `profile.name` returned headline, not display_name — may also affect reviewCount path), the assertion fails. That's the signal we want.
- `05-logout.yaml` — the mobile app's Settings tab + Sign-out button must exist. If the mobile navigation drawer/tab doesn't include it, this is a gap and gets a follow-up (spec 21 didn't explicitly list logout as v0 scope).

Every failing assertion on first run → gap spec + issue, same protocol as spec 25.

## 9. Rollout

1. **Install dependencies** locally: `curl -Ls "https://get.maestro.mobile.dev" | bash` + verify ADB.
2. **Install the preview APK** on the device via `task dev:test:regression:mobile:install`.
3. **Write Flow 1 first** (`01-launch.yaml`) — the minimal "app launches + login works" baseline. Run it. Iterate on selectors until green.
4. **Write Flows 2-5** incrementally.
5. **Document gaps** found during authoring (per §8) as new GH issues.
6. **Add to the daily ritual**: after any `deploy-mobile` preview dispatch, install → run Maestro before hand-testing on device.

## 10. CI deferral

Not in CI in v1. CI needs either:

- A **GitHub-hosted Android emulator runner** (costs real minutes; the sessions timeout on Actions at ~6 hours, should be plenty) — but conflicts with our free-tier posture (spec 17 §manual-only).
- A **self-hosted device farm** (expensive to maintain).

Neither is worth it while we're in Internal Testing. Revisit when we promote to Closed/Open Testing and daily release cadence warrants it.

## 11. Invariants

- **Physical device only.** No emulator guarantees. If a flow works on an emulator but fails on a Samsung/Pixel, emulator result is the false positive. Run against a real device every time.
- **Reviewee scope only.** If an agent (or anyone) proposes `06-admin-approve.yaml`, reject it. Spec 21 / d18 says admin/employer/recruiter are web, not mobile.
- **Against dev API only.** Never point Maestro flows at production. If a flow needs a prod sanity-check, that's a different spec with different credential guards.
- **Dev APK only.** Never run these flows against a production-signed AAB — behavior differs (different Firebase project could exist, different OAuth client IDs).
- **Maestro flows in YAML — no JS, no TypeScript.** Readability in PR review is the whole point. If you need scripting, rewrite the flow instead.

## 12. Open items / follow-ups

- **Flow 6 — review submission from QR scan on device**: the mobile app's own QR scanner + landing flow. Requires a second device (or the same device) to scan a QR displayed elsewhere. Complex to automate; manual test for now.
- **iOS parity** (spec 35.1): add Maestro flows for iOS device — identical YAML since Maestro is cross-platform, but signing-cert bootstrap (spec 17 iOS path) must unblock first.
- **CI integration** when promotion cadence warrants it.
- **Screenshot diffing** (Maestro supports `--screenshot` + baselines) — visual regression for the reviewee daily loop.
- **Deep-link tests** — `reviewapp://r/ramesh-kumar` opens the in-app public-profile view. Needs expo-linking hookup tests; requires the deep-link UI target screen to exist on mobile first (probably doesn't today — file as gap on first authoring pass).
