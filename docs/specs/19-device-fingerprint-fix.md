# Spec 19: Device Fingerprint Length Fix

**Project:** ReviewApp
**Date:** 2026-04-17
**Status:** Done

---

## Problem

Every customer review submission from the deployed QR scan UI was failing
with `400 VALIDATION_ERROR` — users saw `"Failed to start review"` on
screen. The bug blocked **the core flow of the product** (Flow 1 in
`docs/testing-guide.md`).

### Root cause

`apps/web/src/pages/ReviewPage.tsx` — `getDeviceFingerprint()` produced a
short base-36 hash:

```ts
// before
let hash = 0;
for (let i = 0; i < str.length; i++) {
  hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
}
return Math.abs(hash).toString(36); // 6–8 chars typical
```

The API validator (`apps/api/src/modules/verification/verification.validation.ts`)
requires:

```ts
deviceFingerprint: z.string().min(16).max(128)
```

A 6–8 char hash fails `.min(16)` → every `POST /api/v1/reviews/scan/:slug`
returned 400. The error never surfaced during normal dev testing
because:

- Unit/integration tests in `apps/api/tests/` send long mock fingerprints.
- `curl` examples in `docs/testing-guide.md` use `"test1234567890abcdef"` (20 chars).
- Frontend e2e wasn't in place.

Detected via a headed Playwright run against dev (see "How this was
caught" below).

---

## Fix

Use `crypto.subtle.digest("SHA-256", …)` and hex-encode — returns a stable
64-char fingerprint. Comfortably inside `[16, 128]`. Also avoids the
trivially colliding 32-bit custom hash.

```ts
// after
async function getDeviceFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.language,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  const str = parts.join("|");
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(str),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

Callsite updated from `getDeviceFingerprint()` to `await getDeviceFingerprint()`.

`crypto.subtle` is available in all browsers we target (HTTPS-only, modern
evergreen). No polyfill needed.

---

## Files Changed

| File | Change |
|---|---|
| `apps/web/src/pages/ReviewPage.tsx` | `getDeviceFingerprint()` → async SHA-256 hex; callsite now `await`s it |
| `docs/specs/19-device-fingerprint-fix.md` | New — this spec |

---

## How This Was Caught

A Playwright smoke run against the deployed dev environment
(`https://review-scan.teczeed.com`) drove the real customer flow: open
`/r/ramesh-kumar`, tap two quality chips, tap Submit. The rendered DOM
then showed `"Failed to start review"`. Reproducing with curl pinpointed
the validation error:

```
POST /api/v1/reviews/scan/ramesh-kumar
body: {"deviceFingerprint":"a2b4c6"}
→ 400 {"error":"Validation failed: deviceFingerprint: Device fingerprint is required"}
```

Longer fingerprint returned 201 with a `reviewToken`, confirming the
length check was the sole failure.

---

## Regression Guard

Add a headed e2e test in the suite that:

1. Navigates to `/r/<slug>` on the deployed dev scan URL.
2. Clicks 2 quality chips.
3. Clicks Submit.
4. Asserts the page does **not** contain `"Failed to start review"`
   (i.e., the scan POST returned 2xx).

Script used for the initial check: `/tmp/dev_e2e.py` — should graduate
into `apps/api/tests/e2e/` or a new `apps/web/tests/` Playwright suite
so CI catches the regression.
