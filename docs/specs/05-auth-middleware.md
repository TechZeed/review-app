# Spec 05: Authentication, Authorization & Middleware

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Reference:** iepapp middleware patterns (`apps/api/src/middleware/`)
**PRD refs:** PRD 01 (Core Identity), PRD 03 (Review Flow), PRD 05 (Monetization), PRD 06 (Trust & Anti-Fraud)

---

## 1. Authentication Flow

### 1.1 Registered User Authentication (Individual, Employer, Recruiter, Admin)

```
Client                         Server                        Firebase
  |                              |                              |
  |-- Login with email/phone --->|                              |
  |                              |-- Verify Firebase ID token ->|
  |                              |<-- Decoded token (uid, email)|
  |                              |                              |
  |                              |-- Lookup/create user in DB   |
  |                              |-- Issue custom JWT (HS256)   |
  |<---- { accessToken, user } --|                              |
  |                              |                              |
  |-- API call + Bearer token -->|                              |
  |                              |-- Verify JWT (HS256)         |
  |                              |-- Attach user to req         |
  |<---- Response ---------------|                              |
```

**Steps:**

1. Client authenticates via Firebase Auth (email/password, Google OAuth, or phone). Firebase returns an ID token.
2. Client sends the Firebase ID token to `POST /api/auth/login`.
3. Server verifies the Firebase ID token using Firebase Admin SDK (`admin.auth().verifyIdToken(idToken)`).
4. Server looks up the user in the local database by Firebase UID. If first login, creates the user record.
5. Server issues a custom JWT (HS256, signed with `JWT_SECRET`) containing user claims.
6. Client stores the JWT and sends it as `Authorization: Bearer <token>` on all subsequent API calls.
7. The `authenticate` middleware verifies the JWT on protected routes, attaches the user to the request, and checks account status.

### 1.2 Custom JWT Payload

```typescript
interface JwtPayload {
  sub: string;           // User ID (internal DB ID, not Firebase UID)
  email: string;         // User's email
  role: AppUserRole;     // INDIVIDUAL | EMPLOYER | RECRUITER | ADMIN
  isApproved: boolean;   // Account approval status
  status: string;        // 'active' | 'suspended' | 'deactivated'
  tier?: string;         // 'free' | 'pro' (for INDIVIDUAL role)
  iat: number;           // Issued at
  exp: number;           // Expiration
}
```

**Token configuration:**
- Algorithm: HS256
- Expiration: configurable via `JWT_EXPIRATION_TIME_IN_MINUTES` (default 60 minutes)
- Refresh: client re-authenticates via Firebase when the JWT expires. No refresh token flow -- Firebase handles session persistence on the client side.

### 1.3 Reviewer Authentication (Anonymous -- No Account Required)

Reviewers (customers scanning a QR code) do NOT create accounts. Their authentication is handled through a separate flow:

```
Customer                       Server                        Twilio
  |                              |                              |
  |-- Scan QR code ------------->|                              |
  |                              |-- Validate QR token          |
  |                              |-- Generate review session    |
  |<-- { reviewSessionToken } ---|                              |
  |                              |                              |
  |-- Submit qualities + OTP --->|                              |
  |                              |-- Send OTP via SMS/WhatsApp->|
  |                              |                              |-->SMS to phone
  |                              |                              |
  |-- Verify OTP code --------->|                              |
  |                              |-- Validate OTP               |
  |                              |-- Mark session as verified   |
  |<-- { verified: true } ------|                              |
  |                              |                              |
  |-- Submit review ----------->|                              |
  |                              |-- Validate review session    |
  |                              |-- Check OTP verification     |
  |                              |-- Save review                |
  |<-- { success } -------------|                              |
```

**Key points:**
- No Firebase auth, no JWT, no account creation.
- The review session token (opaque, server-side) is the only credential.
- OTP verifies identity (one phone = one review per individual per 7-day window).
- Device fingerprint is captured for fraud detection (composite hash of browser/OS/screen/language).
- Review session token has a 48-hour TTL and is single-use.

---

## 2. Roles & Permissions

### 2.1 Role Definitions

```typescript
export const APP_USER_ROLES = ['INDIVIDUAL', 'EMPLOYER', 'RECRUITER', 'ADMIN'] as const;
export type AppUserRole = (typeof APP_USER_ROLES)[number];
```

The `REVIEWER` is NOT a role in the user system. Reviewers are anonymous and handled through the review session flow (Section 1.3). They never appear in the `users` table.

### 2.2 Permission Matrix

| Resource / Action | INDIVIDUAL | EMPLOYER | RECRUITER | ADMIN |
|---|---|---|---|---|
| Create own profile | Yes | -- | -- | Yes |
| Edit own profile | Yes | -- | -- | Yes |
| View own profile | Yes | -- | -- | Yes |
| View own reviews | Yes | -- | -- | Yes |
| Generate/download QR code | Yes | -- | -- | Yes |
| Tag/untag organization | Yes | Yes (request) | -- | Yes |
| Set profile visibility | Yes | -- | -- | Yes |
| Export profile data (PDF/JSON) | Yes (Pro) | -- | -- | Yes |
| View team dashboard | -- | Yes (consented) | -- | Yes |
| View team leaderboard | -- | Yes (consented) | -- | Yes |
| Search profiles | -- | -- | Yes (paid) | Yes |
| Contact individuals | -- | -- | Yes (paid) | Yes |
| Access verifiable references | -- | -- | Yes (premium) | Yes |
| View fraud queue | -- | -- | -- | Yes |
| Moderate reviews | -- | -- | -- | Yes |
| Manage users | -- | -- | -- | Yes |
| View audit logs | -- | -- | -- | Yes |
| Manage billing/subscriptions | Yes (own) | Yes (own) | Yes (own) | Yes (all) |

### 2.3 Employer Consent Gating

Employers can only see reviews and profiles for individuals who have **explicitly consented** to employer visibility. The `authorize` middleware does not handle this -- it is enforced at the service/query layer:

```typescript
// Service layer enforces consent, not middleware
const teamMembers = await db.query(
  `SELECT * FROM profiles 
   WHERE org_id = $1 
   AND employer_visibility_consent = true`,
  [employerOrgId]
);
```

### 2.4 Recruiter Tier Gating

Recruiter features are gated by subscription tier, enforced via a separate middleware or service check:

| Feature | Basic ($500/mo) | Premium ($1,000/mo) |
|---|---|---|
| Search profiles | Yes | Yes |
| View full profiles | Yes | Yes |
| Contact individuals | 50/month | 200/month |
| Verifiable references | No | Yes |
| ATS export | No | Yes |

---

## 3. Middleware Specifications

All middleware follows the iepapp pattern: Express middleware functions that accept `(req, res, next)`, throw `AppError` on failure, and pass errors to the global error handler via `next(error)`.

### 3.1 authenticate.ts

Verifies the custom JWT (issued by our server after Firebase login) and attaches the user to the request.

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../shared/errors/appError.js';
import { env } from '../config/env.js';
import { APP_USER_ROLES } from './roles.js';

// ---- Request interface ----

export interface AuthUser {
  id: string;
  email: string;
  role: AppUserRole;
  isApproved: boolean;
  status: string;
  tier?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

// ---- Helpers ----

function getBearerToken(authHeader?: string): string {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AppError('No token provided', 401, 'UNAUTHORIZED');
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new AppError('No token provided', 401, 'UNAUTHORIZED');
  }
  return token;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') return value.toLowerCase() === 'true';
  return false;
}

function parseTokenPayload(payload: jwt.JwtPayload | string): {
  sub: string;
  email: string;
  role: string;
  isApproved: boolean;
  status: string;
  tier?: string;
} {
  if (!payload || typeof payload === 'string') {
    throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
  }

  const { sub, email, role, status, tier } = payload;

  if (typeof sub !== 'string' || typeof email !== 'string' || typeof role !== 'string') {
    throw new AppError('Invalid token payload', 401, 'INVALID_TOKEN');
  }

  if (!(APP_USER_ROLES as readonly string[]).includes(role)) {
    throw new AppError('Invalid token role', 401, 'INVALID_TOKEN_ROLE');
  }

  return {
    sub,
    email,
    role,
    isApproved: toBoolean(payload.isApproved),
    status: typeof status === 'string' ? status : 'active',
    tier: typeof tier === 'string' ? tier : undefined,
  };
}

// ---- Middleware ----

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const token = getBearerToken(req.headers.authorization);
    const secret = env.JWT_SECRET;

    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    const parsed = parseTokenPayload(payload);

    req.user = {
      id: parsed.sub,
      email: parsed.email,
      role: parsed.role as AppUserRole,
      isApproved: parsed.isApproved,
      status: parsed.status,
      tier: parsed.tier,
    };

    // Check account status
    if (req.user.status !== 'active') {
      throw new AppError('Account is not active', 403, 'ACCOUNT_NOT_ACTIVE');
    }

    // Check approval -- INDIVIDUAL role is auto-approved on signup
    if (!req.user.isApproved && req.user.role !== 'INDIVIDUAL') {
      throw new AppError('Account pending approval', 403, 'ACCOUNT_PENDING_APPROVAL');
    }

    next();
  } catch (error) {
    if (error instanceof AppError) return next(error);
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401, 'INVALID_TOKEN'));
    }
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401, 'TOKEN_EXPIRED'));
    }
    next(error);
  }
}
```

**Differences from iepapp:**
- Adds `tier` field to the JWT payload and `AuthUser` interface (for Pro/free gating).
- Auto-approval exception is `INDIVIDUAL` instead of iepapp's `PARENT`.
- Firebase token verification happens in the auth route handler (`POST /api/auth/login`), NOT in this middleware. This middleware only verifies the custom JWT issued by our server.

### 3.2 authorize.ts

Role-based authorization middleware factory. Identical pattern to iepapp.

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';
import { AppError } from '../shared/errors/appError.js';
import { APP_USER_ROLES, type AppUserRole } from './roles.js';

function isValidRole(role: string): role is AppUserRole {
  return (APP_USER_ROLES as readonly string[]).includes(role);
}

export function requireRole(allowedRoles: ReadonlyArray<AppUserRole>) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    if (!isValidRole(req.user.role)) {
      return next(new AppError('Invalid user role in token', 401, 'INVALID_TOKEN_ROLE'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403, 'FORBIDDEN'));
    }

    next();
  };
}
```

**Usage:**

```typescript
// Only INDIVIDUAL and ADMIN can access
router.get('/profiles/me', authenticate, requireRole(['INDIVIDUAL', 'ADMIN']), getMyProfile);

// Only EMPLOYER and ADMIN can access
router.get('/team/dashboard', authenticate, requireRole(['EMPLOYER', 'ADMIN']), getTeamDashboard);

// Only RECRUITER and ADMIN can access
router.get('/search/profiles', authenticate, requireRole(['RECRUITER', 'ADMIN']), searchProfiles);
```

### 3.3 validate.ts

Zod-based request validation middleware. Same pattern as iepapp.

```typescript
import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { AppError } from '../shared/errors/appError.js';

export function validateBody<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(`Validation failed: ${JSON.stringify(errors)}`, 400, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req.query);
      Object.keys(req.query).forEach((key) => delete (req.query as any)[key]);
      Object.assign(req.query, parsed);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(`Invalid query parameters: ${JSON.stringify(errors)}`, 400, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
}

export function validateParams<T extends ZodSchema>(schema: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = schema.parse(req.params) as any;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(`Invalid parameters: ${JSON.stringify(errors)}`, 400, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
}

export function validate(schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schema.body) req.body = schema.body.parse(req.body);
      if (schema.params) req.params = schema.params.parse(req.params) as any;
      if (schema.query) {
        const parsed = schema.query.parse(req.query);
        Object.keys(req.query).forEach((key) => delete (req.query as any)[key]);
        Object.assign(req.query, parsed);
      }
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.issues.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        next(new AppError(`Validation failed: ${JSON.stringify(errors)}`, 400, 'VALIDATION_ERROR'));
      } else {
        next(error);
      }
    }
  };
}
```

**Usage with review-app schemas:**

```typescript
import { z } from 'zod';

// Review submission schema (used in the anonymous review flow)
const submitReviewSchema = z.object({
  qualities: z.array(z.enum(['EXPERTISE', 'CARE', 'DELIVERY', 'INITIATIVE', 'TRUST']))
    .min(1, 'Select at least one quality')
    .max(2, 'Select at most two qualities'),
  text: z.string().max(280).optional(),
});

// Profile update schema
const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  industry: z.string().max(100).optional(),
  role: z.string().max(100).optional(),
  visibility: z.enum(['private', 'employer_visible', 'recruiter_visible', 'public']).optional(),
});

// Recruiter search schema
const recruiterSearchSchema = z.object({
  industry: z.string().optional(),
  location: z.string().optional(),
  minReviews: z.coerce.number().int().min(0).optional(),
  qualities: z.string().optional(), // comma-separated quality names
  trustTier: z.enum(['emerging', 'established', 'trusted', 'highly_trusted']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
```

### 3.4 rateLimit.ts

Rate limiting configurations. Same pattern as iepapp with review-app-specific limits.

```typescript
import rateLimit from 'express-rate-limit';

/**
 * Authentication endpoints (login, register)
 * 5 requests per 15 minutes
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * General API endpoints
 * 200 requests per 15 minutes
 */
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: 'Too many requests, please slow down',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * Review submission endpoints
 * 10 requests per 1 hour per device (keyed by IP + device fingerprint header)
 */
export const reviewRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Review rate limit exceeded. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
  keyGenerator: (req) => {
    const deviceFingerprint = req.headers['x-device-fingerprint'] || '';
    return `${req.ip}:${deviceFingerprint}`;
  },
});

/**
 * OTP request endpoints
 * 3 requests per 15 minutes
 */
export const otpRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: 'Too many OTP requests. Please wait before requesting another code.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * Media upload endpoints (voice/video)
 * 5 uploads per 1 hour
 */
export const mediaUploadRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Upload rate limit exceeded. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});

/**
 * Recruiter search endpoints
 * 50 requests per 15 minutes
 */
export const recruiterSearchRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Search rate limit exceeded. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  validate: { trustProxy: false },
});
```

### 3.5 auditLog.ts

Audit logging middleware. Same pattern as iepapp -- intercepts `res.json()` to log after successful responses.

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  metadata?: Record<string, unknown>;
}

export function auditLog(action: string, entityType?: string) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);

    res.json = function (body: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          try {
            const { AuditLogService } = await import('../modules/audit/audit.service.js');

            await AuditLogService.log({
              userId: req.user?.id,
              action,
              entityType: entityType || req.params.entityType,
              entityId: req.params.id || body?.id,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
              status: 'success',
            });
          } catch (error) {
            console.error('Audit log failed:', error);
          }
        });
      }

      return originalJson(body);
    };

    next();
  };
}
```

**Audited actions in review-app:**

| Action | Entity Type | When |
|---|---|---|
| `review.submit` | `review` | A review is submitted (includes anonymous reviewer context) |
| `review.flag` | `review` | A review is flagged by fraud detection |
| `review.moderate` | `review` | Admin approves/rejects a flagged review |
| `profile.view` | `profile` | A profile is viewed (recruiter or public) |
| `profile.update` | `profile` | An individual updates their profile |
| `profile.export` | `profile` | An individual exports their profile data |
| `recruiter.search` | `search` | A recruiter performs a profile search |
| `recruiter.contact` | `message` | A recruiter contacts an individual |
| `reference.request` | `reference` | A recruiter requests a verifiable reference |
| `org.tag` | `org_association` | An individual or employer creates an org tag |
| `org.untag` | `org_association` | An individual or employer removes an org tag |
| `auth.login` | `user` | A user logs in |
| `auth.register` | `user` | A new user registers |
| `visibility.change` | `profile` | An individual changes their profile visibility |

### 3.6 reviewAuth.ts -- NEW (Reviewer Flow Middleware)

This middleware is specific to the review-app. It handles the anonymous reviewer flow where no Firebase auth or JWT is required.

```typescript
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../shared/errors/appError.js';

// ---- Interfaces ----

export interface ReviewSession {
  id: string;
  individualId: string;       // The person being reviewed
  deviceFingerprint: string;  // Composite hash of browser/OS/screen/language
  phoneHash?: string;         // Salted hash of phone number (set after OTP)
  otpVerified: boolean;       // Whether OTP has been verified
  gpsCoordinates?: {          // Optional -- only if permission granted
    latitude: number;
    longitude: number;
  };
  createdAt: Date;            // QR scan timestamp
  expiresAt: Date;            // createdAt + 48 hours
  consumed: boolean;          // True after review is submitted
}

export interface ReviewRequest extends Request {
  reviewSession?: ReviewSession;
}

// ---- Middleware: Validate Review Token ----

/**
 * Validates the review session token from QR scan.
 * Extracts token from header or query param.
 * Attaches the session to the request if valid.
 */
export function validateReviewToken() {
  return async (req: ReviewRequest, res: Response, next: NextFunction) => {
    try {
      const token =
        (req.headers['x-review-token'] as string) ||
        (req.query.reviewToken as string);

      if (!token) {
        throw new AppError('Review token required', 401, 'REVIEW_TOKEN_MISSING');
      }

      // Import dynamically to avoid circular dependencies
      const { ReviewSessionService } = await import(
        '../modules/review/reviewSession.service.js'
      );

      const session = await ReviewSessionService.getByToken(token);

      if (!session) {
        throw new AppError('Invalid review token', 401, 'REVIEW_TOKEN_INVALID');
      }

      if (session.consumed) {
        throw new AppError(
          'This review link has already been used',
          410,
          'REVIEW_TOKEN_CONSUMED'
        );
      }

      if (new Date() > session.expiresAt) {
        throw new AppError(
          'This review link has expired. Please scan the QR code again.',
          410,
          'REVIEW_TOKEN_EXPIRED'
        );
      }

      req.reviewSession = session;
      next();
    } catch (error) {
      if (error instanceof AppError) return next(error);
      next(error);
    }
  };
}

// ---- Middleware: Require OTP Verification ----

/**
 * Ensures the review session has a verified OTP.
 * Must be used AFTER validateReviewToken().
 */
export function requireOtpVerification() {
  return (req: ReviewRequest, res: Response, next: NextFunction) => {
    if (!req.reviewSession) {
      return next(new AppError('Review session required', 401, 'REVIEW_SESSION_MISSING'));
    }

    if (!req.reviewSession.otpVerified) {
      return next(
        new AppError('Phone verification required', 403, 'OTP_VERIFICATION_REQUIRED')
      );
    }

    next();
  };
}

// ---- Middleware: Capture Device Fingerprint ----

/**
 * Captures device fingerprint from the client-provided header.
 * The client computes a composite hash of browser/OS/screen/language
 * and sends it as X-Device-Fingerprint.
 * This middleware validates presence and attaches it to the session.
 */
export function captureDeviceFingerprint() {
  return async (req: ReviewRequest, res: Response, next: NextFunction) => {
    const fingerprint = req.headers['x-device-fingerprint'] as string;

    if (!fingerprint || fingerprint.length < 16) {
      return next(
        new AppError('Device fingerprint required', 400, 'DEVICE_FINGERPRINT_MISSING')
      );
    }

    if (req.reviewSession) {
      // Update session with fingerprint if not already set
      if (!req.reviewSession.deviceFingerprint) {
        try {
          const { ReviewSessionService } = await import(
            '../modules/review/reviewSession.service.js'
          );
          await ReviewSessionService.updateFingerprint(
            req.reviewSession.id,
            fingerprint
          );
          req.reviewSession.deviceFingerprint = fingerprint;
        } catch (error) {
          console.error('Failed to update device fingerprint:', error);
          // Non-blocking -- proceed with the request
        }
      }
    }

    next();
  };
}
```

**Usage in review routes:**

```typescript
import {
  validateReviewToken,
  requireOtpVerification,
  captureDeviceFingerprint,
} from '../middleware/reviewAuth.js';

// QR scan -- create review session (no auth at all)
router.post('/reviews/session', reviewRateLimit, createReviewSession);

// Request OTP -- requires valid review token
router.post(
  '/reviews/otp/request',
  otpRateLimit,
  validateReviewToken(),
  captureDeviceFingerprint(),
  requestOtp
);

// Verify OTP -- requires valid review token
router.post(
  '/reviews/otp/verify',
  otpRateLimit,
  validateReviewToken(),
  verifyOtp
);

// Submit review -- requires valid token + verified OTP
router.post(
  '/reviews/submit',
  reviewRateLimit,
  validateReviewToken(),
  requireOtpVerification(),
  captureDeviceFingerprint(),
  validateBody(submitReviewSchema),
  submitReview
);

// Upload media for an existing review -- requires valid token + verified OTP
router.post(
  '/reviews/:id/media',
  mediaUploadRateLimit,
  validateReviewToken(),
  requireOtpVerification(),
  uploadReviewMedia
);
```

### 3.7 profileOwnership.ts -- Resource Ownership for Profiles

Same pattern as iepapp's `resourceOwnership.ts`, adapted for review-app resource types.

```typescript
import { Response, NextFunction } from 'express';
import { AuthRequest } from './authenticate.js';
import { AppError } from '../shared/errors/appError.js';

export interface ProfileOwnershipOptions {
  resourceType: 'profile' | 'review' | 'org_association' | 'subscription' | 'qr_code';
  paramName?: string;          // defaults to 'id'
  allowRoles?: string[];       // roles that bypass ownership check (ADMIN always bypasses)
}

export function requireProfileOwnership(options: ProfileOwnershipOptions) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }

    // ADMIN always bypasses ownership check
    if (req.user.role === 'ADMIN') {
      return next();
    }

    // Specified roles bypass ownership check
    if (options.allowRoles?.includes(req.user.role)) {
      return next();
    }

    const resourceId = req.params[options.paramName || 'id'];

    try {
      const servicePath = `../modules/${options.resourceType}/${options.resourceType}.service.js`;
      const { verifyOwnership } = await import(servicePath);
      const isOwner = await verifyOwnership(resourceId, req.user.id);

      if (!isOwner) {
        return next(new AppError('Access denied', 403, 'FORBIDDEN'));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
```

**Usage:**

```typescript
// Only the profile owner (or ADMIN) can update
router.put(
  '/profiles/:id',
  authenticate,
  requireRole(['INDIVIDUAL', 'ADMIN']),
  requireProfileOwnership({ resourceType: 'profile' }),
  validateBody(updateProfileSchema),
  updateProfile
);

// Only the profile owner (or ADMIN) can delete org association
router.delete(
  '/profiles/:id/org/:orgId',
  authenticate,
  requireRole(['INDIVIDUAL', 'ADMIN']),
  requireProfileOwnership({ resourceType: 'profile' }),
  removeOrgAssociation
);

// Employer can view reviews for their team (ownership check at service layer via consent)
router.get(
  '/team/reviews',
  authenticate,
  requireRole(['EMPLOYER', 'ADMIN']),
  auditLog('team.reviews.view', 'review'),
  getTeamReviews
);
```

---

## 4. Error Handling

### 4.1 AppError Class

Same pattern as iepapp with additional error subclasses for review-app-specific scenarios.

```typescript
export class AppError extends Error {
  public details?: any;

  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    details?: any,
  ) {
    super(message);
    this.details = details;
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict') {
    super(message, 409, 'CONFLICT');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class GoneError extends AppError {
  constructor(message = 'Resource is no longer available') {
    super(message, 410, 'GONE');
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}
```

### 4.2 Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | No token or invalid credentials |
| `INVALID_TOKEN` | 401 | JWT verification failed |
| `INVALID_TOKEN_ROLE` | 401 | Token contains an unrecognized role |
| `TOKEN_EXPIRED` | 401 | JWT has expired |
| `ACCOUNT_NOT_ACTIVE` | 403 | Account is suspended or deactivated |
| `ACCOUNT_PENDING_APPROVAL` | 403 | Account exists but not yet approved |
| `FORBIDDEN` | 403 | Authenticated but insufficient permissions |
| `NOT_FOUND` | 404 | Resource does not exist |
| `CONFLICT` | 409 | Duplicate resource (e.g., email already registered) |
| `GONE` | 410 | Resource expired (e.g., review token) |
| `VALIDATION_ERROR` | 400 | Request body/params/query failed Zod validation |
| `TOO_MANY_REQUESTS` | 429 | Rate limit exceeded |
| `REVIEW_TOKEN_MISSING` | 401 | No review session token provided |
| `REVIEW_TOKEN_INVALID` | 401 | Review session token not found in DB |
| `REVIEW_TOKEN_CONSUMED` | 410 | Review token already used |
| `REVIEW_TOKEN_EXPIRED` | 410 | Review token past 48-hour TTL |
| `OTP_VERIFICATION_REQUIRED` | 403 | Review session OTP not yet verified |
| `OTP_INVALID` | 400 | Incorrect OTP code |
| `OTP_EXPIRED` | 410 | OTP code past 5-minute expiry |
| `DEVICE_FINGERPRINT_MISSING` | 400 | Missing or invalid device fingerprint header |
| `AUTH_CONFIG_ERROR` | 500 | Server misconfiguration (missing JWT_SECRET, etc.) |

### 4.3 Global Error Handler

```typescript
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppError } from '../shared/errors/appError.js';
import { env } from '../config/env.js';

export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  const traceId = randomUUID();

  if (err instanceof AppError) {
    console.error(`[${traceId}] AppError: ${err.code} - ${err.message}`);

    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.code,
        traceId,
        ...(err.details && env.NODE_ENV !== 'production' ? { details: err.details } : {}),
      },
    });
  }

  // Unhandled errors
  console.error(`[${traceId}] Unhandled error:`, err);

  return res.status(500).json({
    error: {
      message: env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
      code: 'INTERNAL_ERROR',
      traceId,
    },
  });
}
```

**Response shape (all errors):**

```typescript
interface ErrorResponse {
  error: {
    message: string;
    code: string;
    traceId: string;       // UUID for log correlation
    details?: unknown;     // Only in non-production environments
  };
}
```

---

## 5. Environment Configuration

### 5.1 Zod-Validated Env Config

Same pattern as iepapp. All environment variables are validated at startup. Missing required variables cause the server to fail fast with a clear error message.

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  // ---- Server ----
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),

  // ---- Database ----
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('review_app'),
  POSTGRES_USER: z.string().default('review_user'),
  POSTGRES_PASSWORD: z.string().default('changeme'),

  // ---- Auth ----
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRATION_TIME_IN_MINUTES: z.coerce.number().default(60),

  // ---- Firebase ----
  FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  // Or use GOOGLE_APPLICATION_CREDENTIALS for service account JSON path
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // ---- Storage (GCP Cloud Storage) ----
  GCP_BUCKET_NAME: z.string().min(1, 'GCP_BUCKET_NAME is required'),
  GCP_PROJECT_ID: z.string().optional(),

  // ---- Payments (Stripe) ----
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_EMPLOYER_PRICE_ID: z.string().optional(),
  STRIPE_RECRUITER_BASIC_PRICE_ID: z.string().optional(),
  STRIPE_RECRUITER_PREMIUM_PRICE_ID: z.string().optional(),

  // ---- OTP (Twilio) ----
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_VERIFY_SERVICE_SID: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // ---- CDN / Media ----
  CDN_BASE_URL: z.string().url().optional(),
  MAX_VIDEO_SIZE_MB: z.coerce.number().default(50),
  MAX_VOICE_SIZE_MB: z.coerce.number().default(5),

  // ---- QR Code ----
  QR_TOKEN_ROTATION_SECONDS: z.coerce.number().default(60),
  REVIEW_SESSION_TTL_HOURS: z.coerce.number().default(48),

  // ---- Rate Limiting ----
  RATE_LIMIT_TRUST_PROXY: z.enum(['true', 'false']).default('false')
    .transform((val) => val === 'true'),

  // ---- Observability ----
  OTEL_SERVICE_NAME: z.string().default('review-app-api'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),

  // ---- Logging ----
  ENABLE_HTTP_LOGGING: z.enum(['true', 'false']).default('false')
    .transform((val) => val === 'true'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // ---- App URLs ----
  APP_URL: z.string().url().default('http://localhost:3000'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
});

export const env = EnvSchema.parse(process.env);
```

### 5.2 .env.example

```bash
# ---- Server ----
NODE_ENV=development
PORT=3000

# ---- Database ----
# Use DATABASE_URL for production, individual vars for local dev
# DATABASE_URL=postgresql://review_user:changeme@localhost:5432/review_app
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=review_app
POSTGRES_USER=review_user
POSTGRES_PASSWORD=changeme

# ---- Auth ----
# Must be at least 32 characters. Generate with: openssl rand -hex 32
JWT_SECRET=
JWT_EXPIRATION_TIME_IN_MINUTES=60

# ---- Firebase ----
FIREBASE_PROJECT_ID=
# Option 1: Service account credentials inline
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
# Option 2: Path to service account JSON file
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# ---- Storage (GCP Cloud Storage for voice/video uploads) ----
GCP_BUCKET_NAME=
GCP_PROJECT_ID=

# ---- Payments (Stripe) ----
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRO_PRICE_ID=
STRIPE_EMPLOYER_PRICE_ID=
STRIPE_RECRUITER_BASIC_PRICE_ID=
STRIPE_RECRUITER_PREMIUM_PRICE_ID=

# ---- OTP (Twilio Verify) ----
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
TWILIO_PHONE_NUMBER=

# ---- CDN / Media ----
CDN_BASE_URL=
MAX_VIDEO_SIZE_MB=50
MAX_VOICE_SIZE_MB=5

# ---- QR Code ----
QR_TOKEN_ROTATION_SECONDS=60
REVIEW_SESSION_TTL_HOURS=48

# ---- Rate Limiting ----
RATE_LIMIT_TRUST_PROXY=false

# ---- Observability ----
OTEL_SERVICE_NAME=review-app-api
OTEL_EXPORTER_OTLP_ENDPOINT=
OTEL_EXPORTER_OTLP_HEADERS=

# ---- Logging ----
ENABLE_HTTP_LOGGING=false
LOG_LEVEL=info

# ---- App URLs ----
APP_URL=http://localhost:3000
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173
```

---

## 6. Middleware Composition -- Route Examples

### 6.1 Auth Routes (Public)

```typescript
// POST /api/auth/login -- Firebase token exchange
router.post('/auth/login', authRateLimit, validateBody(loginSchema), login);

// POST /api/auth/register -- Firebase token + profile creation
router.post('/auth/register', authRateLimit, validateBody(registerSchema), register);
```

### 6.2 Profile Routes (Authenticated)

```typescript
// GET /api/profiles/me -- own profile
router.get('/profiles/me',
  authenticate,
  requireRole(['INDIVIDUAL', 'ADMIN']),
  getMyProfile
);

// PUT /api/profiles/:id -- update own profile
router.put('/profiles/:id',
  authenticate,
  requireRole(['INDIVIDUAL', 'ADMIN']),
  requireProfileOwnership({ resourceType: 'profile' }),
  validateBody(updateProfileSchema),
  auditLog('profile.update', 'profile'),
  updateProfile
);

// GET /api/profiles/:id -- public profile view (no auth required, but audit logged)
router.get('/profiles/:id',
  auditLog('profile.view', 'profile'),
  getPublicProfile
);
```

### 6.3 Review Routes (Anonymous -- Reviewer Flow)

```typescript
// POST /api/reviews/session -- create session from QR scan (fully public)
router.post('/reviews/session',
  reviewRateLimit,
  validateBody(createSessionSchema),
  createReviewSession
);

// POST /api/reviews/otp/request -- request OTP
router.post('/reviews/otp/request',
  otpRateLimit,
  validateReviewToken(),
  captureDeviceFingerprint(),
  validateBody(requestOtpSchema),
  requestOtp
);

// POST /api/reviews/otp/verify -- verify OTP
router.post('/reviews/otp/verify',
  otpRateLimit,
  validateReviewToken(),
  validateBody(verifyOtpSchema),
  verifyOtp
);

// POST /api/reviews/submit -- submit review
router.post('/reviews/submit',
  reviewRateLimit,
  validateReviewToken(),
  requireOtpVerification(),
  captureDeviceFingerprint(),
  validateBody(submitReviewSchema),
  auditLog('review.submit', 'review'),
  submitReview
);

// POST /api/reviews/:id/media -- attach media
router.post('/reviews/:id/media',
  mediaUploadRateLimit,
  validateReviewToken(),
  requireOtpVerification(),
  uploadReviewMedia
);
```

### 6.4 Employer Routes (Authenticated + Role)

```typescript
// GET /api/team/dashboard
router.get('/team/dashboard',
  authenticate,
  requireRole(['EMPLOYER', 'ADMIN']),
  auditLog('team.dashboard.view', 'dashboard'),
  getTeamDashboard
);

// GET /api/team/leaderboard
router.get('/team/leaderboard',
  authenticate,
  requireRole(['EMPLOYER', 'ADMIN']),
  getTeamLeaderboard
);
```

### 6.5 Recruiter Routes (Authenticated + Role + Rate Limited)

```typescript
// GET /api/search/profiles
router.get('/search/profiles',
  authenticate,
  requireRole(['RECRUITER', 'ADMIN']),
  recruiterSearchRateLimit,
  validateQuery(recruiterSearchSchema),
  auditLog('recruiter.search', 'search'),
  searchProfiles
);

// POST /api/search/profiles/:id/contact
router.post('/search/profiles/:id/contact',
  authenticate,
  requireRole(['RECRUITER', 'ADMIN']),
  auditLog('recruiter.contact', 'message'),
  contactIndividual
);

// GET /api/search/profiles/:id/references
router.get('/search/profiles/:id/references',
  authenticate,
  requireRole(['RECRUITER', 'ADMIN']),
  auditLog('reference.request', 'reference'),
  getVerifiableReferences
);
```

### 6.6 Admin Routes (Authenticated + ADMIN Role)

```typescript
// GET /api/admin/reviews/flagged
router.get('/admin/reviews/flagged',
  authenticate,
  requireRole(['ADMIN']),
  getFlaggedReviews
);

// POST /api/admin/reviews/:id/moderate
router.post('/admin/reviews/:id/moderate',
  authenticate,
  requireRole(['ADMIN']),
  validateBody(moderateReviewSchema),
  auditLog('review.moderate', 'review'),
  moderateReview
);

// GET /api/admin/audit-logs
router.get('/admin/audit-logs',
  authenticate,
  requireRole(['ADMIN']),
  validateQuery(auditLogQuerySchema),
  getAuditLogs
);
```

---

## 7. File Structure

```
apps/api/src/
  config/
    env.ts                    # Zod-validated environment config
    firebase.ts               # Firebase Admin SDK initialization
  middleware/
    authenticate.ts           # JWT verification, AuthRequest interface
    authorize.ts              # requireRole factory
    validate.ts               # Zod validation (body, query, params)
    rateLimit.ts              # Rate limiting configs
    auditLog.ts               # Audit logging middleware
    reviewAuth.ts             # Review session token + OTP + device fingerprint
    profileOwnership.ts       # Resource ownership checks
    roles.ts                  # APP_USER_ROLES constant and AppUserRole type
    errorHandler.ts           # Global error handler with traceId
  shared/
    errors/
      appError.ts             # AppError + subclasses
```

---

## 8. Dependencies

| Package | Version | Purpose |
|---|---|---|
| `express` | ^4.18 | HTTP framework |
| `jsonwebtoken` | ^9.0 | JWT sign/verify (HS256) |
| `firebase-admin` | ^12.0 | Firebase ID token verification |
| `zod` | ^3.22 | Schema validation |
| `express-rate-limit` | ^7.1 | Rate limiting |
| `@google-cloud/storage` | ^7.0 | Media uploads (voice/video) |
| `stripe` | ^14.0 | Payment processing |
| `twilio` | ^4.0 | OTP delivery (SMS/WhatsApp) |

---

## 9. Open Questions

1. **Refresh token strategy:** The current spec has no refresh tokens -- the client re-authenticates via Firebase when the JWT expires. Should we add a refresh token flow for better UX on long sessions (employer dashboard, recruiter search)?

2. **Firebase vs. custom OTP:** Twilio is specified for reviewer OTP. Should we also use Firebase Phone Auth for reviewer OTP to reduce third-party dependencies? Firebase Phone Auth has free tier limits (10K verifications/month) that may be insufficient at scale.

3. **Rate limit storage:** `express-rate-limit` defaults to in-memory storage, which does not work across multiple server instances. For production, this needs a Redis-backed store (`rate-limit-redis`). Should Redis be a required dependency from day one?

4. **Audit log storage:** Should audit logs go to the same Postgres database, a separate analytics database, or an external service (e.g., Datadog, OpenTelemetry)?

5. **Device fingerprint reliability:** Client-side device fingerprinting can be spoofed. Should we invest in a library like FingerprintJS Pro, or is the composite hash sufficient for the trust bar we need to clear (better than LinkedIn endorsements)?
