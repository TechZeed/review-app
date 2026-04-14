# Spec 03: API Endpoints

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**References:** PRDs 01-08, iepapp route/controller/middleware pattern

---

## Architecture Pattern

All routes follow the iepapp middleware chaining pattern:

```typescript
// Router-level middleware (applied to all routes in a module)
router.use(authenticate);
router.use(requireRole(['individual', 'employer']));

// Route-level middleware chain
router.post(
  '/path',
  rateLimitMiddleware,           // Rate limiting
  validateBody(zodSchema),       // Zod validation
  requireResourceOwnership({}),  // Ownership check (where applicable)
  auditLog('action', 'entity'),  // Audit trail
  controller.method
);
```

### Middleware Reference

| Middleware | Purpose |
|-----------|---------|
| `authenticate` | Validates JWT from `Authorization: Bearer <token>` header. Attaches `req.user` with `{ id, role, email }`. |
| `requireRole(roles[])` | Checks `req.user.role` against allowed roles. Returns 403 if unauthorized. Roles: `individual`, `employer`, `recruiter`, `admin`. |
| `validateBody(schema)` | Validates `req.body` against a Zod schema. Returns 400 with structured errors on failure. |
| `validateParams(schema)` | Validates `req.params` against a Zod schema. Returns 400 on failure. |
| `validateQuery(schema)` | Validates `req.query` against a Zod schema. Returns 400 on failure. |
| `requireResourceOwnership(opts)` | Verifies the authenticated user owns the requested resource. Returns 403 on mismatch. |
| `auditLog(action, entity)` | Logs the action to the audit trail with user ID, timestamp, entity type, and entity ID. |
| `authRateLimit` | Strict rate limit for auth endpoints: 10 requests/minute per IP. |
| `apiRateLimit` | Standard rate limit for API endpoints: 100 requests/minute per IP. |
| `uploadRateLimit` | Rate limit for upload endpoints: 10 requests/minute per user. |
| `reviewRateLimit` | Rate limit for review submission: 5 requests/hour per device fingerprint. |
| `searchRateLimit` | Rate limit for search endpoints: 30 requests/minute per user. |
| `verificationRateLimit` | Rate limit for OTP/verification: 5 requests/minute per phone hash. |

### App-Level Route Mounting

```typescript
// app.ts
const v1Router = express.Router();

// Public + auth routes
v1Router.use('/auth', authRouter);

// Profile routes (mixed public/protected)
v1Router.use('/profiles', profileRouter);

// Protected routes
v1Router.use('/reviews', reviewRouter);
v1Router.use('/media', authenticate, mediaRouter);
v1Router.use('/organizations', authenticate, organizationRouter);
v1Router.use('/verification', verificationRouter);
v1Router.use('/references', referenceRouter);
v1Router.use('/recruiter', authenticate, requireRole(['recruiter']), recruiterRouter);
v1Router.use('/employer', authenticate, requireRole(['employer']), employerRouter);
v1Router.use('/subscriptions', subscriptionRouter);

app.use('/api/v1', v1Router);
```

---

## 1. Auth Module (`/api/v1/auth`)

### Routes File Structure

```typescript
// auth.routes.ts
import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { validateBody } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authRateLimit } from '../../middleware/rateLimit.js';
import {
  registerSchema,
  loginSchema,
  verifyPhoneSchema,
} from './auth.validation.js';

export const authRouter = Router();
const controller = new AuthController();
```

---

### POST `/api/v1/auth/register`

Register a new user (individual, recruiter, or employer).

| Attribute | Value |
|-----------|-------|
| **Auth** | Public |
| **Middleware** | `authRateLimit` -> `validateBody(registerSchema)` -> `controller.register` |
| **Rate Limit** | 10 requests/minute per IP |

**Request Body (Zod Schema):**

```typescript
const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['individual', 'recruiter', 'employer']),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/).optional(),  // E.164 format
  firebaseToken: z.string().min(1),                          // Firebase ID token from client auth
  industry: z.string().max(100).optional(),                  // For individuals
  organizationName: z.string().max(200).optional(),          // For employer/recruiter
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ id, email, name, role, accessToken, refreshToken, profile?: { id, slug } }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 409 | `{ error: 'EMAIL_ALREADY_EXISTS' }` |

**Route Definition:**

```typescript
authRouter.post(
  '/register',
  authRateLimit,
  validateBody(registerSchema),
  controller.register
);
```

---

### POST `/api/v1/auth/login`

Exchange Firebase ID token for application JWT.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public |
| **Middleware** | `authRateLimit` -> `validateBody(loginSchema)` -> `controller.login` |
| **Rate Limit** | 10 requests/minute per IP |

**Request Body:**

```typescript
const loginSchema = z.object({
  firebaseToken: z.string().min(1),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, email, name, role, accessToken, refreshToken }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 401 | `{ error: 'INVALID_FIREBASE_TOKEN' }` |
| 404 | `{ error: 'USER_NOT_FOUND' }` |

```typescript
authRouter.post(
  '/login',
  authRateLimit,
  validateBody(loginSchema),
  controller.login
);
```

---

### POST `/api/v1/auth/logout`

Invalidate the current refresh token.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `authenticate` -> `controller.logout` |
| **Rate Limit** | Standard API rate limit |

**Request Body:** None (uses token from Authorization header).

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ message: 'Logged out successfully' }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
authRouter.post(
  '/logout',
  authenticate,
  controller.logout
);
```

---

### GET `/api/v1/auth/me`

Get the authenticated user's account information.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `authenticate` -> `controller.me` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, email, name, role, phone, createdAt, subscription: { tier, expiresAt } }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
authRouter.get(
  '/me',
  authenticate,
  controller.me
);
```

---

### POST `/api/v1/auth/verify-phone`

Verify phone number via OTP for individual users. Required before profile activation.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `verificationRateLimit` -> `validateBody(verifyPhoneSchema)` -> `controller.verifyPhone` |
| **Rate Limit** | 5 requests/minute per user |

**Request Body:**

```typescript
const verifyPhoneSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),   // E.164 format
  otp: z.string().length(6).optional(),             // If verifying; omit to send OTP
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ verified: true }` (when OTP correct) |
| 200 | `{ otpSent: true, expiresIn: 300 }` (when OTP omitted -- sends OTP) |
| 400 | `{ error: 'INVALID_OTP' }` |
| 429 | `{ error: 'TOO_MANY_ATTEMPTS', retryAfter: 900 }` |

```typescript
authRouter.post(
  '/verify-phone',
  authenticate,
  requireRole(['individual']),
  verificationRateLimit,
  validateBody(verifyPhoneSchema),
  controller.verifyPhone
);
```

---

## 2. Profile Module (`/api/v1/profiles`)

### Routes File Structure

```typescript
// profile.routes.ts
import { Router } from 'express';
import { ProfileController } from './profile.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { requireResourceOwnership } from '../../middleware/resourceOwnership.js';
import { auditLog } from '../../middleware/auditLog.js';
import { apiRateLimit } from '../../middleware/rateLimit.js';
import {
  createProfileSchema,
  updateProfileSchema,
  visibilitySchema,
  slugParamSchema,
  statsQuerySchema,
} from './profile.validation.js';

export const profileRouter = Router();
const controller = new ProfileController();
```

---

### POST `/api/v1/profiles`

Create a new profile for the authenticated individual. Auto-generates a slug and QR code.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `validateBody(createProfileSchema)` -> `auditLog('profile_created', 'profile')` -> `controller.create` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const createProfileSchema = z.object({
  name: z.string().min(2).max(100),
  photo: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  visibility: z.enum(['private', 'employer', 'recruiter', 'public']).default('private'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ id, slug, name, qrCodeUrl, profileUrl, visibility, createdAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 409 | `{ error: 'PROFILE_ALREADY_EXISTS' }` |

```typescript
profileRouter.post(
  '/',
  authenticate,
  requireRole(['individual']),
  validateBody(createProfileSchema),
  auditLog('profile_created', 'profile'),
  controller.create
);
```

---

### GET `/api/v1/profiles/:slug`

Get the public profile by slug. This is the QR code landing page endpoint. No authentication required.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public |
| **Middleware** | `validateParams(slugParamSchema)` -> `controller.getBySlug` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const slugParamSchema = z.object({
  slug: z.string().min(4).max(50).regex(/^[a-z0-9-]+$/),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, slug, name, photo, industry, role, bio, organization: { name, role }?, qualityBreakdown: { expertise, care, delivery, initiative, trust }, reviewCount, signatureStrengths: string[], trustTier, profileUrl, badges: string[] }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |
| 403 | `{ error: 'PROFILE_PRIVATE' }` (if visibility is private and requester is not the owner) |

```typescript
profileRouter.get(
  '/:slug',
  validateParams(slugParamSchema),
  controller.getBySlug
);
```

---

### GET `/api/v1/profiles/me`

Get the authenticated user's own profile with full detail.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `controller.getOwn` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, slug, name, photo, industry, role, bio, visibility, organization: { id, name, role }?, qualityBreakdown: {}, reviewCount, signatureStrengths: [], trustTier, qrCodeUrl, profileUrl, createdAt, updatedAt }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |

```typescript
profileRouter.get(
  '/me',
  authenticate,
  requireRole(['individual']),
  controller.getOwn
);
```

**Note:** This route must be registered before `/:slug` to avoid `me` being interpreted as a slug.

---

### PUT `/api/v1/profiles/me`

Update the authenticated user's own profile.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `validateBody(updateProfileSchema)` -> `auditLog('profile_updated', 'profile')` -> `controller.update` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  photo: z.string().url().optional(),
  industry: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, slug, name, photo, industry, role, bio, updatedAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
profileRouter.put(
  '/me',
  authenticate,
  requireRole(['individual']),
  validateBody(updateProfileSchema),
  auditLog('profile_updated', 'profile'),
  controller.update
);
```

---

### PATCH `/api/v1/profiles/me/visibility`

Update profile visibility setting (private, employer, recruiter, public).

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `validateBody(visibilitySchema)` -> `auditLog('visibility_changed', 'profile')` -> `controller.updateVisibility` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const visibilitySchema = z.object({
  visibility: z.enum(['private', 'employer', 'recruiter', 'public']),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ visibility, updatedAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
profileRouter.patch(
  '/me/visibility',
  authenticate,
  requireRole(['individual']),
  validateBody(visibilitySchema),
  auditLog('visibility_changed', 'profile'),
  controller.updateVisibility
);
```

---

### GET `/api/v1/profiles/me/qr`

Get QR code image for the authenticated user's profile.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `controller.getQrCode` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:**

```typescript
const qrQuerySchema = z.object({
  format: z.enum(['png', 'svg']).default('png'),
  size: z.coerce.number().min(200).max(1200).default(300),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | Binary image (`Content-Type: image/png` or `image/svg+xml`) |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
profileRouter.get(
  '/me/qr',
  authenticate,
  requireRole(['individual']),
  controller.getQrCode
);
```

---

### GET `/api/v1/profiles/me/stats`

Get quality breakdown statistics for the authenticated user's profile.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `validateQuery(statsQuerySchema)` -> `controller.getStats` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:**

```typescript
const statsQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '12m', 'all']).default('all'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ totalReviews, totalQualityPicks, qualityBreakdown: { expertise: { count, percentage, isSS }, care: {...}, delivery: {...}, initiative: {...}, trust: {...} }, signatureStrengths: string[], trustTier, profileState: 'new' | 'emerging' | 'established' | 'mature' | 'veteran', recentTrend: { expertise: 'up' | 'down' | 'steady', ... }, mediaBreakdown: { text, voice, video }, verifiableCount }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
profileRouter.get(
  '/me/stats',
  authenticate,
  requireRole(['individual']),
  validateQuery(statsQuerySchema),
  controller.getStats
);
```

---

## 3. Review Module (`/api/v1/reviews`)

### Routes File Structure

```typescript
// review.routes.ts
import { Router } from 'express';
import { ReviewController } from './review.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { reviewRateLimit, apiRateLimit } from '../../middleware/rateLimit.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  scanSchema,
  submitReviewSchema,
  profileIdParamSchema,
  reviewsQuerySchema,
  slugParamSchema,
} from './review.validation.js';

export const reviewRouter = Router();
const controller = new ReviewController();
```

---

### POST `/api/v1/reviews/scan/:slug`

Initiate a review session by scanning a QR code. Generates a review token, captures device fingerprint, location, and timestamp.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (reviewer is an anonymous customer) |
| **Middleware** | `reviewRateLimit` -> `validateParams(slugParamSchema)` -> `validateBody(scanSchema)` -> `controller.scan` |
| **Rate Limit** | 5 scans/hour per device fingerprint |

**Params:**

```typescript
const slugParamSchema = z.object({
  slug: z.string().min(4).max(50),
});
```

**Request Body:**

```typescript
const scanSchema = z.object({
  deviceFingerprint: z.string().min(16).max(128),    // Client-generated composite hash
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  userAgent: z.string().max(500).optional(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ reviewToken, expiresAt, profile: { id, name, photo, organization, role } }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |
| 429 | `{ error: 'RATE_LIMIT_EXCEEDED', retryAfter: number }` |

```typescript
reviewRouter.post(
  '/scan/:slug',
  reviewRateLimit,
  validateParams(slugParamSchema),
  validateBody(scanSchema),
  controller.scan
);
```

---

### POST `/api/v1/reviews/submit`

Submit a review with quality picks and thumbs up. Requires a valid review token from the scan step.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (requires valid review token) |
| **Middleware** | `reviewRateLimit` -> `validateBody(submitReviewSchema)` -> `controller.submit` |
| **Rate Limit** | 5 submissions/hour per device fingerprint |

**Request Body:**

```typescript
const qualityEnum = z.enum(['expertise', 'care', 'delivery', 'initiative', 'trust']);

const submitReviewSchema = z.object({
  reviewToken: z.string().uuid(),
  qualities: z.array(qualityEnum).min(1).max(2),
  qualityDisplayOrder: z.array(qualityEnum).length(5),   // Logged for bias analysis
  thumbsUp: z.literal(true),
  phoneHash: z.string().min(16).optional(),               // After OTP verification
  optInVerifiable: z.boolean().default(false),             // Customer opts in to be contactable
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ reviewId, badgeTier: 'basic' | 'verified' | 'verified_interaction', profileSnapshot: { name, qualityBreakdown }, mediaUploadUrl?: string }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 400 | `{ error: 'INVALID_REVIEW_TOKEN' }` |
| 400 | `{ error: 'REVIEW_TOKEN_EXPIRED' }` |
| 400 | `{ error: 'REVIEW_TOKEN_ALREADY_USED' }` |
| 429 | `{ error: 'DUPLICATE_REVIEW', message: 'One review per individual per 7-day window' }` |

```typescript
reviewRouter.post(
  '/submit',
  reviewRateLimit,
  validateBody(submitReviewSchema),
  controller.submit
);
```

---

### GET `/api/v1/reviews/profile/:profileId`

Get reviews for a profile. Public endpoint, subject to profile visibility settings.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public |
| **Middleware** | `validateParams(profileIdParamSchema)` -> `validateQuery(reviewsQuerySchema)` -> `controller.getByProfile` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const profileIdParamSchema = z.object({
  profileId: z.string().uuid(),
});
```

**Query Parameters:**

```typescript
const reviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  quality: qualityEnum.optional(),                          // Filter by quality
  mediaType: z.enum(['text', 'voice', 'video']).optional(), // Filter by media type
  badgeTier: z.enum(['basic', 'verified', 'verified_interaction', 'verified_testimonial']).optional(),
  sortBy: z.enum(['recent', 'badgeTier']).default('recent'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ reviews: [{ id, qualities, thumbsUp, badgeTier, mediaType?, textContent?, voiceDuration?, videoDuration?, verifiable, createdAt }], pagination: { page, limit, total, totalPages } }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |
| 403 | `{ error: 'PROFILE_PRIVATE' }` |

```typescript
reviewRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  validateQuery(reviewsQuerySchema),
  controller.getByProfile
);
```

---

### GET `/api/v1/reviews/me`

Get reviews received by the authenticated individual.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual'])` |
| **Middleware** | `authenticate` -> `requireRole(['individual'])` -> `validateQuery(reviewsQuerySchema)` -> `controller.getOwn` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:** Same as `GET /reviews/profile/:profileId`.

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ reviews: [{ id, qualities, thumbsUp, badgeTier, mediaType?, textContent?, voiceDuration?, videoDuration?, verifiable, createdAt, deviceLocation?: { lat, lng } }], pagination: { page, limit, total, totalPages } }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
reviewRouter.get(
  '/me',
  authenticate,
  requireRole(['individual']),
  validateQuery(reviewsQuerySchema),
  controller.getOwn
);
```

---

## 4. Media Module (`/api/v1/media`)

### Routes File Structure

```typescript
// media.routes.ts
import { Router } from 'express';
import { MediaController } from './media.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { uploadRateLimit } from '../../middleware/rateLimit.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  uploadMediaSchema,
  mediaIdParamSchema,
} from './media.validation.js';

export const mediaRouter = Router();
const controller = new MediaController();
```

---

### POST `/api/v1/media/upload`

Upload voice, video, or text media to an existing submitted review. Requires a valid review token (media can be appended within 24 hours of submission).

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (requires valid review token from submission) |
| **Middleware** | `uploadRateLimit` -> `validateBody(uploadMediaSchema)` -> `auditLog('media_uploaded', 'media')` -> `controller.upload` |
| **Rate Limit** | 10 uploads/minute per device fingerprint |

**Request Body:**

```typescript
const uploadMediaSchema = z.object({
  reviewToken: z.string().uuid(),
  reviewId: z.string().uuid(),
  mediaType: z.enum(['text', 'voice', 'video']),
  textContent: z.string().max(280).optional(),               // For text media
  // For voice/video: presigned URL returned; client uploads binary directly to storage
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ mediaId, presignedUploadUrl?: string, expiresAt?: string }` (presigned URL for voice/video binary upload) |
| 201 | `{ mediaId, textContent }` (for text media, stored immediately) |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 400 | `{ error: 'INVALID_REVIEW_TOKEN' }` |
| 400 | `{ error: 'MEDIA_ALREADY_ATTACHED' }` (only one media per review) |
| 400 | `{ error: 'MEDIA_WINDOW_EXPIRED', message: 'Media can only be added within 24 hours of review' }` |

```typescript
mediaRouter.post(
  '/upload',
  uploadRateLimit,
  validateBody(uploadMediaSchema),
  auditLog('media_uploaded', 'media'),
  controller.upload
);
```

---

### GET `/api/v1/media/:mediaId`

Stream media content (voice/video). Returns media file via CDN redirect.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (respects profile visibility) |
| **Middleware** | `validateParams(mediaIdParamSchema)` -> `controller.stream` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const mediaIdParamSchema = z.object({
  mediaId: z.string().uuid(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 302 | Redirect to CDN URL for media file |
| 404 | `{ error: 'MEDIA_NOT_FOUND' }` |
| 403 | `{ error: 'PROFILE_PRIVATE' }` |

```typescript
mediaRouter.get(
  '/:mediaId',
  validateParams(mediaIdParamSchema),
  controller.stream
);
```

---

### GET `/api/v1/media/:mediaId/signed-url`

Get a time-limited signed URL for direct media access (used by clients for HLS video playback).

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (respects profile visibility) |
| **Middleware** | `validateParams(mediaIdParamSchema)` -> `controller.getSignedUrl` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ signedUrl, expiresAt, mediaType, duration?, transcription? }` |
| 404 | `{ error: 'MEDIA_NOT_FOUND' }` |
| 403 | `{ error: 'PROFILE_PRIVATE' }` |

```typescript
mediaRouter.get(
  '/:mediaId/signed-url',
  validateParams(mediaIdParamSchema),
  controller.getSignedUrl
);
```

---

## 5. Organization Module (`/api/v1/organizations`)

### Routes File Structure

```typescript
// organization.routes.ts
import { Router } from 'express';
import { OrganizationController } from './organization.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { requireResourceOwnership } from '../../middleware/resourceOwnership.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  createOrgSchema,
  orgIdParamSchema,
  tagOrgSchema,
  profileOrgIdParamSchema,
} from './organization.validation.js';

export const organizationRouter = Router();
const controller = new OrganizationController();

// All routes require authentication
organizationRouter.use(authenticate);
```

---

### POST `/api/v1/organizations`

Create a new organization (employer or recruiter creates their org).

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['employer', 'admin'])` |
| **Middleware** | `requireRole(['employer', 'admin'])` -> `validateBody(createOrgSchema)` -> `auditLog('org_created', 'organization')` -> `controller.create` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const createOrgSchema = z.object({
  name: z.string().min(2).max(200),
  industry: z.string().max(100),
  website: z.string().url().optional(),
  location: z.object({
    city: z.string().max(100),
    state: z.string().max(100).optional(),
    country: z.string().length(2),                   // ISO 3166-1 alpha-2
  }),
  size: z.enum(['1-25', '26-100', '101-500', '500+']).optional(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ id, name, industry, website, location, size, createdAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 409 | `{ error: 'ORGANIZATION_ALREADY_EXISTS' }` |

```typescript
organizationRouter.post(
  '/',
  requireRole(['employer', 'admin']),
  validateBody(createOrgSchema),
  auditLog('org_created', 'organization'),
  controller.create
);
```

---

### GET `/api/v1/organizations/:id`

Get organization details.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `validateParams(orgIdParamSchema)` -> `controller.getById` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const orgIdParamSchema = z.object({
  id: z.string().uuid(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, name, industry, website, location, size, teamCount, createdAt }` |
| 404 | `{ error: 'ORGANIZATION_NOT_FOUND' }` |

```typescript
organizationRouter.get(
  '/:id',
  validateParams(orgIdParamSchema),
  controller.getById
);
```

---

### POST `/api/v1/organizations/tag`

Tag an organization to an individual's profile. Can be initiated by either the individual or the employer. Requires consent from both parties.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual', 'employer'])` |
| **Middleware** | `requireRole(['individual', 'employer'])` -> `validateBody(tagOrgSchema)` -> `auditLog('org_tagged', 'profile_organization')` -> `controller.tag` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const tagOrgSchema = z.object({
  profileId: z.string().uuid().optional(),           // Required when employer is tagging
  organizationId: z.string().uuid().optional(),      // Required when individual is tagging
  role: z.string().max(100),                         // e.g., "Sales Associate"
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ profileOrgId, profileId, organizationId, role, status: 'pending' | 'active', createdAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` or `{ error: 'ORGANIZATION_NOT_FOUND' }` |
| 409 | `{ error: 'TAG_ALREADY_EXISTS' }` |

```typescript
organizationRouter.post(
  '/tag',
  requireRole(['individual', 'employer']),
  validateBody(tagOrgSchema),
  auditLog('org_tagged', 'profile_organization'),
  controller.tag
);
```

---

### DELETE `/api/v1/organizations/untag/:profileOrgId`

Untag an organization from a profile. Individual can always untag; employer can also untag.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['individual', 'employer'])` |
| **Middleware** | `requireRole(['individual', 'employer'])` -> `validateParams(profileOrgIdParamSchema)` -> `requireResourceOwnership({ resourceType: 'profile_organization' })` -> `auditLog('org_untagged', 'profile_organization')` -> `controller.untag` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const profileOrgIdParamSchema = z.object({
  profileOrgId: z.string().uuid(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ message: 'Organization untagged successfully', reviewsRetained: true }` |
| 404 | `{ error: 'TAG_NOT_FOUND' }` |
| 403 | `{ error: 'NOT_AUTHORIZED_TO_UNTAG' }` |

```typescript
organizationRouter.delete(
  '/untag/:profileOrgId',
  requireRole(['individual', 'employer']),
  validateParams(profileOrgIdParamSchema),
  requireResourceOwnership({ resourceType: 'profile_organization' }),
  auditLog('org_untagged', 'profile_organization'),
  controller.untag
);
```

---

### GET `/api/v1/organizations/me/team`

Get team members for the authenticated employer's organization.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['employer'])` |
| **Middleware** | `requireRole(['employer'])` -> `validateQuery(teamQuerySchema)` -> `controller.getTeam` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:**

```typescript
const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['name', 'reviewCount', 'qualityScore']).default('name'),
  quality: qualityEnum.optional(),               // Filter by dominant quality
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ team: [{ profileId, name, photo, role, reviewCount, qualityBreakdown, signatureStrengths, trustTier, lastReviewAt }], pagination: { page, limit, total, totalPages } }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
organizationRouter.get(
  '/me/team',
  requireRole(['employer']),
  validateQuery(teamQuerySchema),
  controller.getTeam
);
```

---

## 6. Verification Module (`/api/v1/verification`)

### Routes File Structure

```typescript
// verification.routes.ts
import { Router } from 'express';
import { VerificationController } from './verification.controller.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { verificationRateLimit } from '../../middleware/rateLimit.js';
import {
  sendOtpSchema,
  verifyOtpSchema,
  tokenIdParamSchema,
} from './verification.validation.js';

export const verificationRouter = Router();
const controller = new VerificationController();
```

---

### POST `/api/v1/verification/otp/send`

Send an OTP to the reviewer's phone number during the review flow.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (requires valid review token) |
| **Middleware** | `verificationRateLimit` -> `validateBody(sendOtpSchema)` -> `controller.sendOtp` |
| **Rate Limit** | 5 requests/minute per phone hash; 3 phone numbers per device per 30 days |

**Request Body:**

```typescript
const sendOtpSchema = z.object({
  reviewToken: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),     // E.164 format
  channel: z.enum(['sms', 'whatsapp']).default('sms'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ otpSent: true, expiresIn: 300, channel: 'sms' | 'whatsapp' }` |
| 400 | `{ error: 'INVALID_REVIEW_TOKEN' }` |
| 429 | `{ error: 'OTP_RATE_LIMIT', retryAfter: 60 }` |
| 429 | `{ error: 'DEVICE_PHONE_LIMIT', message: 'Maximum 3 phone numbers per device per 30 days' }` |

```typescript
verificationRouter.post(
  '/otp/send',
  verificationRateLimit,
  validateBody(sendOtpSchema),
  controller.sendOtp
);
```

---

### POST `/api/v1/verification/otp/verify`

Verify the OTP code entered by the reviewer.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (requires valid review token) |
| **Middleware** | `verificationRateLimit` -> `validateBody(verifyOtpSchema)` -> `controller.verifyOtp` |
| **Rate Limit** | 5 requests/minute per phone hash |

**Request Body:**

```typescript
const verifyOtpSchema = z.object({
  reviewToken: z.string().uuid(),
  phone: z.string().regex(/^\+[1-9]\d{6,14}$/),
  otp: z.string().length(6).regex(/^\d{6}$/),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ verified: true, phoneHash: string }` |
| 400 | `{ error: 'INVALID_OTP' }` |
| 400 | `{ error: 'OTP_EXPIRED' }` |
| 429 | `{ error: 'TOO_MANY_ATTEMPTS', retryAfter: 900, lockoutUntil: string }` |

```typescript
verificationRouter.post(
  '/otp/verify',
  verificationRateLimit,
  validateBody(verifyOtpSchema),
  controller.verifyOtp
);
```

---

### GET `/api/v1/verification/token/:tokenId`

Validate a review token (check if it is still valid, not expired, not used).

| Attribute | Value |
|-----------|-------|
| **Auth** | Public |
| **Middleware** | `validateParams(tokenIdParamSchema)` -> `controller.validateToken` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const tokenIdParamSchema = z.object({
  tokenId: z.string().uuid(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ valid: true, expiresAt, profileId, profileName }` |
| 400 | `{ valid: false, reason: 'expired' | 'used' | 'invalid' }` |

```typescript
verificationRouter.get(
  '/token/:tokenId',
  validateParams(tokenIdParamSchema),
  controller.validateToken
);
```

---

## 7. Reference Module (`/api/v1/references`)

### Routes File Structure

```typescript
// reference.routes.ts
import { Router } from 'express';
import { ReferenceController } from './reference.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/auditLog.js';
import { apiRateLimit } from '../../middleware/rateLimit.js';
import {
  optInSchema,
  referenceIdParamSchema,
  requestReferenceSchema,
  profileIdParamSchema,
} from './reference.validation.js';

export const referenceRouter = Router();
const controller = new ReferenceController();
```

---

### POST `/api/v1/references/opt-in`

Customer opts in to be contactable for verification of a specific review.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (requires valid review token -- called immediately after review submission) |
| **Middleware** | `validateBody(optInSchema)` -> `auditLog('reference_opt_in', 'reference')` -> `controller.optIn` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const optInSchema = z.object({
  reviewToken: z.string().uuid(),
  reviewId: z.string().uuid(),
  consentVersion: z.string().default('1.0'),       // Consent text version for audit
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ referenceId, reviewId, status: 'active', createdAt }` |
| 400 | `{ error: 'INVALID_REVIEW_TOKEN' }` |
| 400 | `{ error: 'REVIEW_NOT_FOUND' }` |
| 409 | `{ error: 'ALREADY_OPTED_IN' }` |

```typescript
referenceRouter.post(
  '/opt-in',
  validateBody(optInSchema),
  auditLog('reference_opt_in', 'reference'),
  controller.optIn
);
```

---

### DELETE `/api/v1/references/withdraw/:referenceId`

Customer withdraws consent to be contactable. Immediate effect: "Verifiable" badge removed.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (uses a secure withdrawal token sent via SMS/email to the customer) |
| **Middleware** | `validateParams(referenceIdParamSchema)` -> `validateBody(withdrawSchema)` -> `auditLog('reference_withdrawn', 'reference')` -> `controller.withdraw` |
| **Rate Limit** | Standard API rate limit |

**Params:**

```typescript
const referenceIdParamSchema = z.object({
  referenceId: z.string().uuid(),
});
```

**Request Body:**

```typescript
const withdrawSchema = z.object({
  withdrawalToken: z.string().min(16),             // Secure token from notification link
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ withdrawn: true, badgeRemoved: true }` |
| 400 | `{ error: 'INVALID_WITHDRAWAL_TOKEN' }` |
| 404 | `{ error: 'REFERENCE_NOT_FOUND' }` |

```typescript
referenceRouter.delete(
  '/withdraw/:referenceId',
  validateParams(referenceIdParamSchema),
  validateBody(withdrawSchema),
  auditLog('reference_withdrawn', 'reference'),
  controller.withdraw
);
```

---

### POST `/api/v1/references/request`

Recruiter requests to contact a verified reviewer. Platform mediates the contact (no PII shared).

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['recruiter'])` |
| **Middleware** | `authenticate` -> `requireRole(['recruiter'])` -> `validateBody(requestReferenceSchema)` -> `auditLog('reference_requested', 'reference')` -> `controller.request` |
| **Rate Limit** | 5 reference requests per candidate per month; 50 total per month (basic), 200 per month (premium) |

**Request Body:**

```typescript
const requestReferenceSchema = z.object({
  referenceId: z.string().uuid(),
  companyName: z.string().max(200),
  hiringRole: z.string().max(200),
  message: z.string().max(300),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ requestId, status: 'pending', estimatedResponseTime: '48h' }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED', requiredTier: 'premium' }` |
| 404 | `{ error: 'REFERENCE_NOT_FOUND' }` |
| 429 | `{ error: 'REFERENCE_REQUEST_LIMIT', message: 'Maximum 5 requests per candidate per month' }` |

```typescript
referenceRouter.post(
  '/request',
  authenticate,
  requireRole(['recruiter']),
  validateBody(requestReferenceSchema),
  auditLog('reference_requested', 'reference'),
  controller.request
);
```

---

### GET `/api/v1/references/profile/:profileId`

Get the count of verifiable references for a profile. Does not expose individual reference details.

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (respects profile visibility) |
| **Middleware** | `validateParams(profileIdParamSchema)` -> `controller.getCountByProfile` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ profileId, verifiableCount, totalReviews, verifiablePercentage }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |
| 403 | `{ error: 'PROFILE_PRIVATE' }` |

```typescript
referenceRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  controller.getCountByProfile
);
```

---

## 8. Recruiter Module (`/api/v1/recruiter`)

### Routes File Structure

```typescript
// recruiter.routes.ts
import { Router } from 'express';
import { RecruiterController } from './recruiter.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { searchRateLimit } from '../../middleware/rateLimit.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  searchSchema,
  profileIdParamSchema,
  contactSchema,
} from './recruiter.validation.js';

export const recruiterRouter = Router();
const controller = new RecruiterController();

// All routes require authentication + recruiter role
recruiterRouter.use(authenticate);
recruiterRouter.use(requireRole(['recruiter']));
```

---

### POST `/api/v1/recruiter/search`

Search profiles by qualities, industry, location, and other filters. Only returns profiles with `recruiter` or `public` visibility.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['recruiter'])` |
| **Middleware** | `searchRateLimit` -> `validateBody(searchSchema)` -> `auditLog('recruiter_search', 'search')` -> `controller.search` |
| **Rate Limit** | 30 searches/minute per user |

**Request Body:**

```typescript
const searchSchema = z.object({
  qualities: z.array(z.object({
    quality: qualityEnum,
    minPercentage: z.number().min(0).max(100),
  })).max(5).optional(),
  industry: z.string().max(100).optional(),
  location: z.object({
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    country: z.string().length(2).optional(),
    radiusKm: z.number().min(1).max(500).optional(),
  }).optional(),
  minReviewCount: z.coerce.number().int().min(0).default(0),
  minTrustTier: z.enum(['emerging', 'established', 'trusted', 'highly_trusted']).optional(),
  hasVideo: z.boolean().optional(),
  hasVerifiableReferences: z.boolean().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sortBy: z.enum(['relevance', 'reviewCount', 'trustTier', 'recent']).default('relevance'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ results: [{ profileId, slug, name, photo, industry, role, organization?, qualityBreakdown, reviewCount, signatureStrengths, trustTier, hasVideo, verifiableCount, isPro }], pagination: { page, limit, total, totalPages } }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED' }` |

```typescript
recruiterRouter.post(
  '/search',
  searchRateLimit,
  validateBody(searchSchema),
  auditLog('recruiter_search', 'search'),
  controller.search
);
```

---

### GET `/api/v1/recruiter/profile/:profileId`

View full profile detail for a recruiter-visible or public profile. Paid access endpoint.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['recruiter'])` |
| **Middleware** | `validateParams(profileIdParamSchema)` -> `auditLog('recruiter_profile_view', 'profile')` -> `controller.viewProfile` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ profile: { id, slug, name, photo, industry, role, bio, organization?, qualityBreakdown, reviewCount, signatureStrengths, trustTier, verifiableCount, mediaBreakdown, recentReviews: Review[], badges }, accessLevel: 'basic' | 'premium' }` |
| 403 | `{ error: 'PROFILE_NOT_VISIBLE' }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED' }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |

```typescript
recruiterRouter.get(
  '/profile/:profileId',
  validateParams(profileIdParamSchema),
  auditLog('recruiter_profile_view', 'profile'),
  controller.viewProfile
);
```

---

### POST `/api/v1/recruiter/contact/:profileId`

Send a contact request to an individual through the platform (InMail equivalent).

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['recruiter'])` |
| **Middleware** | `validateParams(profileIdParamSchema)` -> `validateBody(contactSchema)` -> `auditLog('recruiter_contact', 'contact_request')` -> `controller.contact` |
| **Rate Limit** | 50 contacts/month (basic), 200 contacts/month (premium) per recruiter seat |

**Request Body:**

```typescript
const contactSchema = z.object({
  subject: z.string().min(5).max(200),
  message: z.string().min(10).max(1000),
  hiringRole: z.string().max(200),
  companyName: z.string().max(200),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ contactRequestId, status: 'sent', createdAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 403 | `{ error: 'PROFILE_NOT_VISIBLE' }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED' }` |
| 429 | `{ error: 'CONTACT_LIMIT_REACHED', message: 'Monthly contact limit exceeded', limit: 50, resetAt: string }` |

```typescript
recruiterRouter.post(
  '/contact/:profileId',
  validateParams(profileIdParamSchema),
  validateBody(contactSchema),
  auditLog('recruiter_contact', 'contact_request'),
  controller.contact
);
```

---

## 9. Employer Module (`/api/v1/employer`)

### Routes File Structure

```typescript
// employer.routes.ts
import { Router } from 'express';
import { EmployerController } from './employer.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { requireRole } from '../../middleware/authorize.js';
import { validateParams, validateQuery } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  profileIdParamSchema,
  dashboardQuerySchema,
  teamQuerySchema,
} from './employer.validation.js';

export const employerRouter = Router();
const controller = new EmployerController();

// All routes require authentication + employer role
employerRouter.use(authenticate);
employerRouter.use(requireRole(['employer']));
```

---

### GET `/api/v1/employer/dashboard`

Get the team reputation dashboard with aggregate stats.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['employer'])` |
| **Middleware** | `validateQuery(dashboardQuerySchema)` -> `controller.getDashboard` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:**

```typescript
const dashboardQuerySchema = z.object({
  period: z.enum(['7d', '30d', '90d', '12m']).default('30d'),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ organizationId, organizationName, teamSize, period, aggregateQualityBreakdown: { expertise, care, delivery, initiative, trust }, totalReviews, avgReviewsPerMember, topPerformers: [{ profileId, name, reviewCount, dominantQuality }], qualityTrend: [{ date, expertise, care, delivery, initiative, trust }], retentionAlerts: [{ profileId, name, signal, detail }] }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED' }` |

```typescript
employerRouter.get(
  '/dashboard',
  validateQuery(dashboardQuerySchema),
  controller.getDashboard
);
```

---

### GET `/api/v1/employer/team`

List all team members with quality scores and review data.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['employer'])` |
| **Middleware** | `validateQuery(teamQuerySchema)` -> `controller.getTeam` |
| **Rate Limit** | Standard API rate limit |

**Query Parameters:**

```typescript
const teamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['name', 'reviewCount', 'qualityScore', 'recentActivity']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  quality: qualityEnum.optional(),
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ team: [{ profileId, name, photo, role, reviewCount, qualityBreakdown, signatureStrengths, trustTier, lastReviewAt, reviewVelocity, hasConsented: true }], pagination: { page, limit, total, totalPages } }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |
| 403 | `{ error: 'SUBSCRIPTION_REQUIRED' }` |

```typescript
employerRouter.get(
  '/team',
  validateQuery(teamQuerySchema),
  controller.getTeam
);
```

---

### GET `/api/v1/employer/team/:profileId`

Get detailed view of an individual team member (with their consent).

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` + `requireRole(['employer'])` |
| **Middleware** | `validateParams(profileIdParamSchema)` -> `auditLog('employer_team_member_view', 'profile')` -> `controller.getTeamMember` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ profileId, name, photo, role, reviewCount, qualityBreakdown, signatureStrengths, trustTier, recentReviews: [{ id, qualities, badgeTier, mediaType, textContent, createdAt }], qualityTrend: [{ date, expertise, care, delivery, initiative, trust }], reviewVelocity: { current, previous, changePercent } }` |
| 403 | `{ error: 'EMPLOYEE_NOT_CONSENTED' }` |
| 403 | `{ error: 'NOT_YOUR_TEAM_MEMBER' }` |
| 404 | `{ error: 'PROFILE_NOT_FOUND' }` |

```typescript
employerRouter.get(
  '/team/:profileId',
  validateParams(profileIdParamSchema),
  auditLog('employer_team_member_view', 'profile'),
  controller.getTeamMember
);
```

---

## 10. Subscription Module (`/api/v1/subscriptions`)

### Routes File Structure

```typescript
// subscription.routes.ts
import { Router } from 'express';
import { SubscriptionController } from './subscription.controller.js';
import { authenticate } from '../../middleware/authenticate.js';
import { validateBody } from '../../middleware/validate.js';
import { auditLog } from '../../middleware/auditLog.js';
import {
  checkoutSchema,
  cancelSchema,
} from './subscription.validation.js';

export const subscriptionRouter = Router();
const controller = new SubscriptionController();
```

---

### POST `/api/v1/subscriptions/checkout`

Create a Stripe checkout session for subscription purchase.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `authenticate` -> `validateBody(checkoutSchema)` -> `auditLog('checkout_created', 'subscription')` -> `controller.createCheckout` |
| **Rate Limit** | 5 requests/minute per user |

**Request Body:**

```typescript
const checkoutSchema = z.object({
  tier: z.enum(['pro_individual', 'employer_small', 'employer_medium', 'employer_large', 'recruiter_basic', 'recruiter_premium']),
  billingCycle: z.enum(['monthly', 'annual']).default('monthly'),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  locationCount: z.coerce.number().int().min(1).optional(),   // For employer tiers
  seatCount: z.coerce.number().int().min(1).optional(),       // For recruiter tiers
});
```

**Responses:**

| Status | Body |
|--------|------|
| 201 | `{ checkoutSessionId, checkoutUrl, expiresAt }` |
| 400 | `{ error: 'VALIDATION_ERROR', details: ZodError[] }` |
| 409 | `{ error: 'ACTIVE_SUBSCRIPTION_EXISTS' }` |

```typescript
subscriptionRouter.post(
  '/checkout',
  authenticate,
  validateBody(checkoutSchema),
  auditLog('checkout_created', 'subscription'),
  controller.createCheckout
);
```

---

### POST `/api/v1/subscriptions/webhook`

Stripe webhook handler for subscription lifecycle events (payment success, failure, cancellation, renewal).

| Attribute | Value |
|-----------|-------|
| **Auth** | Public (verified via Stripe webhook signature) |
| **Middleware** | `controller.webhook` (raw body parsing + Stripe signature validation inside controller) |
| **Rate Limit** | None (Stripe controls the rate) |

**Request Body:** Raw Stripe event payload (parsed with `express.raw({ type: 'application/json' })`).

**Handled Events:**
- `checkout.session.completed` -- Activate subscription
- `invoice.payment_succeeded` -- Renew subscription
- `invoice.payment_failed` -- Mark subscription at risk
- `customer.subscription.deleted` -- Deactivate subscription
- `customer.subscription.updated` -- Update subscription tier

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ received: true }` |
| 400 | `{ error: 'INVALID_WEBHOOK_SIGNATURE' }` |

```typescript
subscriptionRouter.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  controller.webhook
);
```

**Note:** This route must be mounted before any `express.json()` body parser middleware that would consume the raw body. Handle via a dedicated sub-app or conditional middleware.

---

### GET `/api/v1/subscriptions/me`

Get the current user's subscription details.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `authenticate` -> `controller.getCurrent` |
| **Rate Limit** | Standard API rate limit |

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ id, tier, status: 'active' | 'past_due' | 'cancelled' | 'none', billingCycle, currentPeriodStart, currentPeriodEnd, locationCount?, seatCount?, features: string[], cancelAtPeriodEnd: boolean }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
subscriptionRouter.get(
  '/me',
  authenticate,
  controller.getCurrent
);
```

---

### POST `/api/v1/subscriptions/cancel`

Cancel the current subscription. Takes effect at end of billing period.

| Attribute | Value |
|-----------|-------|
| **Auth** | `authenticate` |
| **Middleware** | `authenticate` -> `validateBody(cancelSchema)` -> `auditLog('subscription_cancelled', 'subscription')` -> `controller.cancel` |
| **Rate Limit** | Standard API rate limit |

**Request Body:**

```typescript
const cancelSchema = z.object({
  reason: z.string().max(500).optional(),
  immediate: z.boolean().default(false),           // true = cancel now, false = cancel at period end
});
```

**Responses:**

| Status | Body |
|--------|------|
| 200 | `{ cancelled: true, effectiveAt: string, cancelAtPeriodEnd: boolean }` |
| 400 | `{ error: 'NO_ACTIVE_SUBSCRIPTION' }` |
| 401 | `{ error: 'UNAUTHORIZED' }` |

```typescript
subscriptionRouter.post(
  '/cancel',
  authenticate,
  validateBody(cancelSchema),
  auditLog('subscription_cancelled', 'subscription'),
  controller.cancel
);
```

---

## Rate Limiting Summary

| Category | Limit | Scope | Applies To |
|----------|-------|-------|------------|
| Auth endpoints | 10 req/min | Per IP | `/auth/*` |
| Standard API | 100 req/min | Per IP | All other endpoints |
| Review scan/submit | 5 req/hr | Per device fingerprint | `/reviews/scan`, `/reviews/submit` |
| Media upload | 10 req/min | Per user/device | `/media/upload` |
| OTP/Verification | 5 req/min | Per phone hash | `/verification/otp/*` |
| Recruiter search | 30 req/min | Per user | `/recruiter/search` |
| Recruiter contact | 50/month (basic), 200/month (premium) | Per recruiter seat | `/recruiter/contact` |
| Reference requests | 5/candidate/month | Per recruiter | `/references/request` |
| Subscription checkout | 5 req/min | Per user | `/subscriptions/checkout` |

---

## Error Response Format

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  error: string;                    // Machine-readable error code (UPPER_SNAKE_CASE)
  message?: string;                 // Human-readable description
  details?: ZodError[] | object;    // Validation error details (400 only)
  retryAfter?: number;              // Seconds until retry (429 only)
}
```

### Standard HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success (read, update, action) |
| 201 | Created (new resource) |
| 302 | Redirect (media streaming) |
| 400 | Validation error, invalid input, business rule violation |
| 401 | Missing or invalid authentication token |
| 403 | Authenticated but not authorized (wrong role, not owner, profile private) |
| 404 | Resource not found |
| 409 | Conflict (duplicate resource) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
