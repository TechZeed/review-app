# Spec 20 — Reviewee Polish (v0)

**Decision reference.** Ties to huddle decision **d17** (2026-04-17): v0 focus is Reviewee (mobile-responsive web/PWA) + Employer/Recruiter (desktop). Reviewer stays on mobile browser via `apps/web`. Native mobile (`apps/mobile`) parked.

**Goal.** Make `apps/ui` genuinely good for the Reviewee's daily loop on a phone. Done when Sarah the nurse can install the app to her home screen, open it, see today's reviews, and share her QR to a friend in under 10 seconds.

**Non-goals.**
- Recruiter search (separate later spec).
- Native mobile app (`apps/mobile` stays parked).
- Admin role-approval UI.
- Stripe subscription flows inside `apps/ui`.
- Any API changes — if something on the server is wrong, log it in [spec 19](./19-mobile-api-bugs.md), don't fix it here.

---

## The Reviewee daily loop we're optimising

1. **Open the app** → see count of new reviews since last visit, recognisable profile header.
2. **Tap a new review** → read it. (Already works; just verify mobile readability.)
3. **Share my QR** → one tap, native share sheet or download, URL encoded is the public profile link.
4. **Close the app** → come back tomorrow.

Everything else on the Dashboard (heatmap, stats, history) is context for this loop, not the loop itself.

---

## Scope — three tracks

### Track A — Real QR code on Dashboard + Profile

**Currently.** `apps/ui/src/components/ProfileCard.tsx:65–74` shows a dashed placeholder box with text "QR Code (scan to review)". Not functional.

**Target.** A real QR image encoding the public reviewer URL:
- URL to encode: `${VITE_FRONTEND_URL}/r/${slug}` where `VITE_FRONTEND_URL` comes from Vite env (already in `.env.dev` as `FRONTEND_URL=https://review-scan.teczeed.com`).
- Library choice: **`qrcode.react`** (pure React, no canvas fallback quirks, 8kb) — install via `npm i qrcode.react`.
- Rendered inline as `<QRCodeSVG>` for crisp scaling on hi-dpi phones.
- Size: 240px on mobile, 180px on desktop dashboard.
- Include 8px white quiet-zone padding.
- Below the QR: the encoded URL as copyable text (small, monospace, muted) so people without a scanner can type it.

**Files to touch.**
- `apps/ui/src/components/ProfileCard.tsx` — replace dashed box (line 65–74 region).
- `apps/ui/package.json` — add `qrcode.react` dep.

**Acceptance.**
- QR scans correctly from a second phone pointing at the dashboard screen.
- QR is present on `/dashboard` (my view) and `/profile/:slug` (public view).
- No `console.error` or missing-asset warnings.

---

### Track B — Mobile-responsive pass + PWA install

**Currently.** `apps/ui` is built with Tailwind + Vite. Audit didn't verify mobile layout. No PWA manifest.

**Target.**

1. **Viewport meta.** `apps/ui/index.html` must include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Verify and add if missing.

2. **PWA manifest.** Add `apps/ui/public/manifest.webmanifest` with:
   ```json
   {
     "name": "Review",
     "short_name": "Review",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#4f46e5",
     "theme_color": "#4f46e5",
     "icons": [
       { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
       { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
     ]
   }
   ```
   Plus `<link rel="manifest" href="/manifest.webmanifest">` and `<link rel="apple-touch-icon" href="/icon-192.png">` in `index.html`. Icons can temporarily reuse `apps/mobile/assets/icon.png` — copy them to `apps/ui/public/`.

3. **Layout audit at 375×812 (iPhone SE / 13 mini baseline).** Pages to verify visually:
   - `/login` — single-button page should centre nicely.
   - `/dashboard` — two-column layout must **collapse to single column** below 768px. Suspect `DashboardPage.tsx` uses a `grid` that may need `md:` prefixes on column counts.
   - `/profile/:slug` — same collapse rule.
   - `NavBar` — user name + links may overflow. Allow truncate + hamburger if needed.

4. **No service worker for v0.** Offline support is out of scope. Installability + home-screen icon is the only PWA ask.

**Files to touch.**
- `apps/ui/index.html` — viewport meta + manifest/apple-touch-icon links.
- `apps/ui/public/manifest.webmanifest` — new.
- `apps/ui/public/icon-192.png`, `icon-512.png` — copy from mobile assets.
- `apps/ui/src/pages/DashboardPage.tsx` — responsive grid.
- `apps/ui/src/pages/ProfilePage.tsx` — responsive grid.
- `apps/ui/src/components/NavBar.tsx` — responsive header.

**Acceptance.**
- At 375px width, every page is usable: no horizontal scroll, no overlap, QR visible without zoom.
- Chrome on Android shows "Add to Home Screen" prompt (triggered via install criteria).
- Installed PWA opens with app icon, no browser chrome, status bar coloured `#4f46e5`.

---

### Track C — Share my QR

**Currently.** No share action exists.

**Target.** A "Share my QR" button near the QR on the Dashboard.

**Primary path — Web Share API (level 2, with file).**
```ts
const blob = await qrToBlob(qrSvgRef.current); // render SVG → canvas → PNG blob
const file = new File([blob], `${slug}-review-qr.png`, { type: "image/png" });
if (navigator.canShare?.({ files: [file] })) {
  await navigator.share({
    files: [file],
    title: "Review me",
    text: `Scan to leave a quick review → ${publicUrl}`,
  });
}
```

**Fallback — download PNG.** If `navigator.canShare` returns false or throws, trigger a `<a download>` of the same PNG blob.

**Copy fallback.** Also show a "Copy link" action that copies the public URL to clipboard via `navigator.clipboard.writeText(publicUrl)`.

**Files to touch.**
- `apps/ui/src/components/ProfileCard.tsx` — new `ShareQRButton` subcomponent.
- Small util `apps/ui/src/lib/shareQr.ts` for SVG→PNG blob + share/download branching.

**Acceptance.**
- On iOS Safari and Android Chrome, tapping "Share my QR" opens the native share sheet with the QR image attached.
- On desktop Chrome/Firefox, tapping it downloads a PNG.
- "Copy link" toast confirms to the user the link was copied.

---

## Out of scope (explicit)

- Fixing `apps/web` review flow bugs (deviceFingerprint) — that's API work, tracked in spec 19.
- Implementing the quality filter (`DashboardPage.tsx:84` console.log).
- Pagination UI on reviews list.
- Retry buttons on failed API calls.
- Removing the unused `/api/v1/qualities` fetch.
- Anything in `apps/mobile/`.
- Employer/Recruiter flows.

---

## Order of execution

1. **Track A** first (real QR) — unblocks Track C and has immediate visible value.
2. **Track B** second (responsive + PWA) — verifies existing screens before we build on top.
3. **Track C** last (share flow) — depends on A, benefits from B.

Estimate: ~1 focused day if all API endpoints behave. Add buffer if spec-19 bugs block anything.

---

## Success criteria — done when all true

- [ ] I can scan the Dashboard QR from a second phone and land on the public profile URL.
- [ ] Add-to-Home-Screen on Android Chrome installs the app with our icon and theme colour.
- [ ] All three pages (`/login`, `/dashboard`, `/profile/:slug`) are usable at 375×812 with no horizontal scroll.
- [ ] "Share my QR" opens the native share sheet on mobile, downloads PNG on desktop.
- [ ] No new API changes; any API issues found are appended to spec 19.
