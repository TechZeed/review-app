# Spec 33 — Scanner Media Persistence (Text/Voice/Video)

**Project:** ReviewApp
**Repo:** TechZeed/review-app
**Date:** 2026-04-19
**Status:** Draft (gap discovered while writing regression flow 11-scanner-media)
**PRD References:** PRD 02 (10-second review loop — "+ optional voice/video/text"), PRD 06 (anti-fraud — "verified testimonial" badge requires voice/video evidence).

---

## 1. Problem

After the scanner OTP-verifies and `/reviews/submit` returns 200, the web app (`apps/web/src/components/MediaPrompt.tsx`) renders a "Review saved! Want to add more?" step with **Text / Voice / Video / Done** CTAs. The intent is to collect richer content tied to the just-created review, which then powers the verified-testimonial badge (spec 06) and the public profile heatmap (spec 32).

Two implementation gaps block end-to-end persistence today:

1. **Wrong endpoint.** `MediaPrompt.tsx` posts to `POST /api/v1/reviews/:reviewId/media`, but the API only exposes `POST /api/v1/media/upload` (see `apps/api/src/modules/media/media.routes.ts`). The mismatch silently 404s — the component swallows the error and proceeds to ThankYou.
2. **Null repository.** `MediaController` is constructed with `new MediaRepository(null as any)` (`apps/api/src/modules/media/media.controller.ts`). Even if the path were right, persisting a `review_media` row would throw on the `null` sequelize model.

Voice and video CTAs are also currently disabled stubs in the UI.

## 2. Goals

- Web text submission lands a `review_media` row keyed to the parent review id.
- Voice (≤15s) and video (≤30s) capture in browser, upload via multer, persist to GCS, write `review_media` with `media_url`, queue moderation.
- API path: a single canonical `POST /api/v1/reviews/:reviewId/media` (auth = the still-valid review token). The legacy `/media/upload` is removed or kept only as an internal alias.
- Mobile parity: same endpoint, same payload shape.

## 3. Non-goals

- No transcription pipeline in this spec (transcription column already exists; populate later).
- No moderation UX (admin queue is a separate spec).
- No editing/deleting media post-submit.

## 4. Data / API surface

`POST /api/v1/reviews/:reviewId/media`

Body (text):

```json
{ "reviewToken": "<uuid>", "type": "text", "content": "..." }
```

Body (voice/video) is multipart with `file` + the JSON fields.

Response: `201 { id, mediaType, contentText|mediaUrl, moderationStatus: "pending" }`.

Auth: review token must match the review's `review_token_id` and not yet have a media row of the same `media_type` (one media of each type max per review).

DB: `review_media` table already exists (`apps/api/src/modules/media/media.model.ts`). No migration needed for text. Voice/video need GCS bucket + signed-url pipeline.

## 5. Rollout plan

1. Wire `MediaRepository` with the real Sequelize model in `MediaController`.
2. Add `POST /reviews/:reviewId/media` route under `reviewRouter`, delegating to `MediaService.uploadText` for text payloads.
3. Update `MediaPrompt.tsx` to send `reviewToken` alongside `reviewId`.
4. Un-skip the third test case in `apps/regression/src/flows/11-scanner-media.spec.ts` ("Add text review persists a review_media row").
5. Voice/video capture lands behind a follow-up spec.
