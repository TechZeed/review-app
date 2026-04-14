# Spec 01: Project Structure

**Project:** review-app (Portable Individual Review/Reputation App)
**Date:** 2026-04-14
**Reference:** iepapp/apps/api/ patterns (Express 5 + Sequelize 6 + Firebase Auth + GCP)

---

## Tech Stack (Locked)

| Layer | Technology |
|-------|-----------|
| Frontend (customer) | React 19 + Vite + Tailwind (mobile-first web) |
| Frontend (individual/recruiter) | React 19 + Vite + Tailwind (desktop web app) |
| Backend | Node.js 23 + Express 5 + TypeScript (ES modules) |
| Database | Cloud SQL (Postgres) + Sequelize 6 ORM + Umzug migrations |
| Auth | Firebase Auth + Firebase Admin SDK + custom JWT + RBAC |
| File Storage | GCP Cloud Storage + signed URLs + multer |
| Validation | Zod |
| Testing | Vitest + Supertest + Faker |
| Hosting | GCP Cloud Run (asia-southeast1) |
| Payments | Stripe |
| QR Generation | qrcode npm package |
| CI/CD | GitHub Actions |

---

## Full Directory Tree

```
review-app/
├── apps/
│   └── api/
│       ├── package.json
│       ├── package-lock.json
│       ├── tsconfig.json
│       ├── vitest.config.ts
│       ├── Dockerfile
│       ├── docker-compose.yaml
│       ├── .env.example
│       ├── Taskfile.yml
│       ├── src/
│       │   ├── server.ts
│       │   ├── app.ts
│       │   │
│       │   ├── config/
│       │   │   ├── env.ts
│       │   │   ├── appenv.ts
│       │   │   ├── logger.ts
│       │   │   ├── firebase.ts
│       │   │   ├── sequelize.ts
│       │   │   ├── storage.ts
│       │   │   ├── stripe.ts
│       │   │   └── swagger.ts
│       │   │
│       │   ├── middleware/
│       │   │   ├── authenticate.ts
│       │   │   ├── authorize.ts
│       │   │   ├── roles.ts
│       │   │   ├── validate.ts
│       │   │   ├── rateLimit.ts
│       │   │   ├── auditLog.ts
│       │   │   ├── requestContext.ts
│       │   │   └── errorHandler.ts
│       │   │
│       │   ├── shared/
│       │   │   ├── errors/
│       │   │   │   └── appError.ts
│       │   │   ├── db/
│       │   │   │   └── base.repo.ts
│       │   │   ├── storage/
│       │   │   │   ├── gcs.ts
│       │   │   │   └── secrets.ts
│       │   │   └── utils.ts
│       │   │
│       │   ├── db/
│       │   │   ├── umzug.ts
│       │   │   ├── migrate.ts
│       │   │   ├── cli.ts
│       │   │   ├── seed.ts
│       │   │   ├── seed-cli.ts
│       │   │   ├── migrations/
│       │   │   │   ├── 20260414-0000-create-extensions.ts
│       │   │   │   ├── 20260414-0001-create-users.ts
│       │   │   │   ├── 20260414-0002-create-profiles.ts
│       │   │   │   ├── 20260414-0003-create-qualities.ts
│       │   │   │   ├── 20260414-0004-create-reviews.ts
│       │   │   │   ├── 20260414-0005-create-media.ts
│       │   │   │   ├── 20260414-0006-create-organizations.ts
│       │   │   │   ├── 20260414-0007-create-verifications.ts
│       │   │   │   ├── 20260414-0008-create-references.ts
│       │   │   │   └── 20260414-0009-create-subscriptions.ts
│       │   │   └── seeds/
│       │   │       ├── 20260414-0000-seed-qualities.ts
│       │   │       └── 20260414-0001-seed-subscription-tiers.ts
│       │   │
│       │   ├── health/
│       │   │   └── health.routes.ts
│       │   │
│       │   └── modules/
│       │       ├── auth/
│       │       │   ├── auth.model.ts
│       │       │   ├── auth.controller.ts
│       │       │   ├── auth.service.ts
│       │       │   ├── auth.repo.ts
│       │       │   ├── auth.routes.ts
│       │       │   ├── auth.types.ts
│       │       │   └── auth.validation.ts
│       │       │
│       │       ├── profile/
│       │       │   ├── profile.model.ts
│       │       │   ├── profile.controller.ts
│       │       │   ├── profile.service.ts
│       │       │   ├── profile.repo.ts
│       │       │   ├── profile.routes.ts
│       │       │   ├── profile.types.ts
│       │       │   ├── profile.validation.ts
│       │       │   └── qr.service.ts
│       │       │
│       │       ├── review/
│       │       │   ├── review.model.ts
│       │       │   ├── review.controller.ts
│       │       │   ├── review.service.ts
│       │       │   ├── review.repo.ts
│       │       │   ├── review.routes.ts
│       │       │   ├── review.types.ts
│       │       │   └── review.validation.ts
│       │       │
│       │       ├── media/
│       │       │   ├── media.model.ts
│       │       │   ├── media.controller.ts
│       │       │   ├── media.service.ts
│       │       │   ├── media.repo.ts
│       │       │   ├── media.routes.ts
│       │       │   ├── media.types.ts
│       │       │   ├── media.validation.ts
│       │       │   └── upload/
│       │       │       └── multer.config.ts
│       │       │
│       │       ├── organization/
│       │       │   ├── organization.model.ts
│       │       │   ├── organization.controller.ts
│       │       │   ├── organization.service.ts
│       │       │   ├── organization.repo.ts
│       │       │   ├── organization.routes.ts
│       │       │   ├── organization.types.ts
│       │       │   └── organization.validation.ts
│       │       │
│       │       ├── quality/
│       │       │   ├── quality.model.ts
│       │       │   ├── quality.controller.ts
│       │       │   ├── quality.service.ts
│       │       │   ├── quality.repo.ts
│       │       │   ├── quality.routes.ts
│       │       │   ├── quality.types.ts
│       │       │   └── quality.validation.ts
│       │       │
│       │       ├── recruiter/
│       │       │   ├── recruiter.model.ts
│       │       │   ├── recruiter.controller.ts
│       │       │   ├── recruiter.service.ts
│       │       │   ├── recruiter.repo.ts
│       │       │   ├── recruiter.routes.ts
│       │       │   ├── recruiter.types.ts
│       │       │   └── recruiter.validation.ts
│       │       │
│       │       ├── employer/
│       │       │   ├── employer.model.ts
│       │       │   ├── employer.controller.ts
│       │       │   ├── employer.service.ts
│       │       │   ├── employer.repo.ts
│       │       │   ├── employer.routes.ts
│       │       │   ├── employer.types.ts
│       │       │   └── employer.validation.ts
│       │       │
│       │       ├── verification/
│       │       │   ├── verification.model.ts
│       │       │   ├── verification.controller.ts
│       │       │   ├── verification.service.ts
│       │       │   ├── verification.repo.ts
│       │       │   ├── verification.routes.ts
│       │       │   ├── verification.types.ts
│       │       │   └── verification.validation.ts
│       │       │
│       │       ├── reference/
│       │       │   ├── reference.model.ts
│       │       │   ├── reference.controller.ts
│       │       │   ├── reference.service.ts
│       │       │   ├── reference.repo.ts
│       │       │   ├── reference.routes.ts
│       │       │   ├── reference.types.ts
│       │       │   └── reference.validation.ts
│       │       │
│       │       └── subscription/
│       │           ├── subscription.model.ts
│       │           ├── subscription.controller.ts
│       │           ├── subscription.service.ts
│       │           ├── subscription.repo.ts
│       │           ├── subscription.routes.ts
│       │           ├── subscription.types.ts
│       │           ├── subscription.validation.ts
│       │           └── stripe.webhook.ts
│       │
│       └── tests/
│           ├── unit/
│           │   ├── auth.service.test.ts
│           │   ├── profile.service.test.ts
│           │   ├── review.service.test.ts
│           │   ├── verification.service.test.ts
│           │   └── quality.service.test.ts
│           ├── integration/
│           │   ├── auth.test.ts
│           │   ├── profile.test.ts
│           │   ├── review.test.ts
│           │   └── subscription.test.ts
│           ├── e2e/
│           │   └── review-flow.test.ts
│           └── utils/
│               ├── setup.ts
│               ├── factories.ts
│               └── testDb.ts
│
├── docs/
│   ├── brainstorms/
│   │   └── 2026-04-14-review-app-brainstorm.md
│   └── specs/
│       └── 01-project-structure.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
└── .gitignore
```

---

## Module Specifications

### 1. auth

Firebase Auth integration, custom JWT issuance, user registration/login, RBAC.

| File | Purpose |
|------|---------|
| `auth.model.ts` | `User` Sequelize model — id (UUID), firebaseUid, email, displayName, phone, role (enum: individual/customer/recruiter/employer/admin), status, lastLoginAt, timestamps |
| `auth.controller.ts` | Handlers: register, login, refreshToken, me, updateRole |
| `auth.service.ts` | Verify Firebase ID token via Admin SDK, issue custom JWT with role claims, create/find user in DB |
| `auth.repo.ts` | Extends `BaseRepo<User>` — findByFirebaseUid, findByEmail |
| `auth.routes.ts` | POST /register, POST /login, POST /refresh, GET /me, PATCH /role (admin) |
| `auth.types.ts` | RegisterInput, LoginInput, AuthPayload, JwtClaims, UserRole enum |
| `auth.validation.ts` | Zod schemas: registerSchema, loginSchema, updateRoleSchema |

**Roles (RBAC):**

| Role | Description |
|------|-------------|
| `individual` | The person who owns a profile and collects reviews |
| `customer` | A person leaving a review (created on first review submission) |
| `recruiter` | Paid seat — searches and contacts individuals |
| `employer` | Paid seat — manages team views, sees org-tagged profiles |
| `admin` | Platform admin |

---

### 2. profile

Individual profile CRUD, QR code generation, public/private visibility controls.

| File | Purpose |
|------|---------|
| `profile.model.ts` | `Profile` — id (UUID), userId (FK), slug (unique), headline, industry, location, avatarUrl, qrCodeUrl, visibility (enum: public/recruiter-only/private), totalReviews, timestamps |
| `profile.controller.ts` | Handlers: create, getBySlug (public), getById, update, regenerateQr, getMyProfile |
| `profile.service.ts` | Profile CRUD, generate QR code via `qrcode` package, upload QR to GCS, aggregate quality scores |
| `profile.repo.ts` | Extends `BaseRepo<Profile>` — findBySlug, findByUserId, searchByIndustryAndLocation |
| `profile.routes.ts` | POST /, GET /:slug (public), GET /me, PATCH /, POST /qr/regenerate |
| `profile.types.ts` | CreateProfileInput, UpdateProfileInput, ProfileVisibility enum, ProfileWithScores |
| `profile.validation.ts` | Zod schemas: createProfileSchema, updateProfileSchema |
| `qr.service.ts` | Generate QR code PNG from profile URL, upload to GCS, return signed URL |

---

### 3. review

Review submission flow: quality picks (1-2 mandatory), thumbs up (mandatory), optional rich media.

| File | Purpose |
|------|---------|
| `review.model.ts` | `Review` — id (UUID), profileId (FK), reviewerPhone (hashed), qualityPicks (array of quality IDs, 1-2), thumbsUp (boolean, always true), mediaId (FK, nullable), verificationId (FK), deviceFingerprint, locationLat, locationLng, tokenUsedAt, status (active/flagged/removed), timestamps |
| `review.controller.ts` | Handlers: submit, getByProfile (paginated), getById, flag, remove (admin) |
| `review.service.ts` | Validate review token, enforce one-review-per-phone-per-profile-per-week, create review + increment profile counters, run anti-fraud checks |
| `review.repo.ts` | Extends `BaseRepo<Review>` — findByProfile (paginated), countByProfile, findByReviewerAndProfile |
| `review.routes.ts` | POST / (public, after OTP), GET /profile/:profileId (public), GET /:id, PATCH /:id/flag (admin) |
| `review.types.ts` | SubmitReviewInput, ReviewResponse, ReviewStatus enum |
| `review.validation.ts` | Zod schemas: submitReviewSchema (qualityPicks min 1 max 2, thumbsUp required) |

---

### 4. media

Voice/video/text upload to GCS, signed URL generation, media metadata storage.

| File | Purpose |
|------|---------|
| `media.model.ts` | `Media` — id (UUID), reviewId (FK), type (enum: text/voice/video), content (text only), gcsPath (voice/video), mimeType, durationSeconds, sizeBytes, timestamps |
| `media.controller.ts` | Handlers: upload, getById, getSignedUrl, delete |
| `media.service.ts` | Handle multipart upload via multer, stream to GCS, generate signed download URLs, validate file type/size |
| `media.repo.ts` | Extends `BaseRepo<Media>` — findByReviewId |
| `media.routes.ts` | POST /upload, GET /:id, GET /:id/url, DELETE /:id |
| `media.types.ts` | MediaType enum, UploadMediaInput, MediaResponse |
| `media.validation.ts` | Zod schemas: uploadMediaSchema (type, maxDuration, maxSize) |
| `upload/multer.config.ts` | Multer config — memory storage, file size limits (voice: 5MB/15s, video: 25MB/30s) |

---

### 5. organization

Org creation, tagging/untagging on individual profiles. Org is a guest, individual is sovereign.

| File | Purpose |
|------|---------|
| `organization.model.ts` | `Organization` — id (UUID), name, domain, logoUrl, timestamps. `OrganizationMember` — id, orgId (FK), profileId (FK), title, startDate, endDate (nullable = current), status (active/former), taggedByUserId, timestamps |
| `organization.controller.ts` | Handlers: create, tag (link profile to org), untag (individual removes org), getByProfile, getMembers |
| `organization.service.ts` | Org CRUD, tag/untag logic (individual controls), list org members for employer dashboard |
| `organization.repo.ts` | Extends `BaseRepo<Organization>` — findByDomain. `OrganizationMemberRepo` — findByProfile, findActiveByOrg |
| `organization.routes.ts` | POST /, POST /:orgId/tag, DELETE /:orgId/untag, GET /profile/:profileId, GET /:orgId/members |
| `organization.types.ts` | CreateOrgInput, TagInput, OrgMemberStatus enum |
| `organization.validation.ts` | Zod schemas: createOrgSchema, tagSchema |

---

### 6. quality

Five qualities framework: Expertise, Care, Delivery, Initiative, Trust. Seeded data, aggregation logic.

| File | Purpose |
|------|---------|
| `quality.model.ts` | `Quality` — id (UUID), name (enum), label, description, customerLanguage, sortOrder. `QualityScore` — id, profileId (FK), qualityId (FK), pickCount, percentage, updatedAt |
| `quality.controller.ts` | Handlers: list (all qualities), getScoresByProfile |
| `quality.service.ts` | Return seeded qualities, compute and cache per-profile quality scores from review picks |
| `quality.repo.ts` | Extends `BaseRepo<Quality>`. `QualityScoreRepo` — findByProfile, upsertScore |
| `quality.routes.ts` | GET / (public, list all five), GET /profile/:profileId (public, scores) |
| `quality.types.ts` | QualityName enum (expertise/care/delivery/initiative/trust), QualityScoreResponse |
| `quality.validation.ts` | Zod schemas: qualityPicksSchema (array of quality IDs, min 1 max 2) |

**Seeded Qualities:**

| Name | Label | Customer Language |
|------|-------|-------------------|
| expertise | Expertise | "Expert in their domain" |
| care | Care | "Made me feel valued" |
| delivery | Delivery | "Did exactly what they promised" |
| initiative | Initiative | "Went beyond what I asked" |
| trust | Trust | "I'd come back to this person" |

---

### 7. recruiter

Recruiter search, profile access, contact flow. Paid tier.

| File | Purpose |
|------|---------|
| `recruiter.model.ts` | `RecruiterProfile` — id (UUID), userId (FK), companyName, seatsUsed, maxSeats, subscriptionId (FK), timestamps. `ProfileView` — id, recruiterId (FK), profileId (FK), viewedAt. `ContactRequest` — id, recruiterId (FK), profileId (FK), message, status (pending/accepted/declined), timestamps |
| `recruiter.controller.ts` | Handlers: search (by industry, location, quality scores), viewProfile, requestContact, getViewHistory |
| `recruiter.service.ts` | Full-text search on profiles filtered by visibility, log profile views, send contact requests, enforce seat limits |
| `recruiter.repo.ts` | Extends `BaseRepo<RecruiterProfile>` — search with quality score filters, countViews |
| `recruiter.routes.ts` | GET /search, GET /profile/:id, POST /contact/:profileId, GET /history |
| `recruiter.types.ts` | SearchFilters, ContactRequestInput, ContactStatus enum |
| `recruiter.validation.ts` | Zod schemas: searchSchema, contactRequestSchema |

---

### 8. employer

Employer dashboard, team views, org-level analytics.

| File | Purpose |
|------|---------|
| `employer.model.ts` | `EmployerDashboard` — id (UUID), userId (FK), orgId (FK), subscriptionId (FK), timestamps |
| `employer.controller.ts` | Handlers: getDashboard, getTeamScores, getTopPerformers, getRetentionSignals |
| `employer.service.ts` | Aggregate team quality scores, identify top performers, flag retention risks (declining review velocity) |
| `employer.repo.ts` | Extends `BaseRepo<EmployerDashboard>` — findByOrg, getTeamProfiles |
| `employer.routes.ts` | GET /dashboard, GET /team/scores, GET /team/top, GET /team/retention |
| `employer.types.ts` | DashboardResponse, TeamScoreResponse, RetentionSignal |
| `employer.validation.ts` | Zod schemas: dashboardQuerySchema (date range, filters) |

---

### 9. verification

OTP verification for reviewers, time-window review tokens, device fingerprinting, anti-fraud layers.

| File | Purpose |
|------|---------|
| `verification.model.ts` | `Verification` — id (UUID), phone (hashed), otp (hashed), profileId (FK), reviewToken (UUID), tokenExpiresAt (24-48h), deviceFingerprint, locationLat, locationLng, verifiedAt, status (pending/verified/expired/flagged), timestamps |
| `verification.controller.ts` | Handlers: initiate (QR scan triggers), verifyOtp, checkToken |
| `verification.service.ts` | Generate OTP, send via SMS provider, verify OTP, issue time-window review token, capture device fingerprint + geolocation, run anti-fraud pattern detection (velocity, device clustering) |
| `verification.repo.ts` | Extends `BaseRepo<Verification>` — findByPhone, findByToken, countRecentByDevice |
| `verification.routes.ts` | POST /initiate, POST /verify-otp, GET /token/:token/valid |
| `verification.types.ts` | InitiateInput, VerifyOtpInput, VerificationStatus enum, ReviewToken |
| `verification.validation.ts` | Zod schemas: initiateSchema (phone required), verifyOtpSchema |

**Anti-Fraud Layers (5-layer stack from brainstorm):**

1. QR scan captures timestamp, location, device fingerprint
2. Phone OTP — one phone, one review per individual per week
3. Time-window token — 24-48h expiry, non-stockpilable
4. AI pattern detection — velocity spikes, device clusters, identical quality picks
5. Video/voice trust amplifier — "Verified Testimonial" badge

---

### 10. reference

Verifiable reference opt-in: customer agrees to be contacted by potential employers.

| File | Purpose |
|------|---------|
| `reference.model.ts` | `Reference` — id (UUID), reviewId (FK), profileId (FK), customerName, customerPhone (encrypted), customerEmail (encrypted), consentGivenAt, consentRevoked (boolean), contactCount, lastContactedAt, timestamps |
| `reference.controller.ts` | Handlers: optIn, revoke, getByProfile, requestContact (recruiter/employer) |
| `reference.service.ts` | Record consent at review time, allow revocation, mediate contact requests (never expose raw contact info), increment contact counter |
| `reference.repo.ts` | Extends `BaseRepo<Reference>` — findByProfile, findByReview, findConsentedByProfile |
| `reference.routes.ts` | POST /opt-in, DELETE /:id/revoke, GET /profile/:profileId, POST /:id/contact |
| `reference.types.ts` | OptInInput, ReferenceResponse, ContactReferenceInput |
| `reference.validation.ts` | Zod schemas: optInSchema, contactReferenceSchema |

---

### 11. subscription

Stripe payment integration, tier management, webhook handling.

| File | Purpose |
|------|---------|
| `subscription.model.ts` | `Subscription` — id (UUID), userId (FK), stripeCustomerId, stripeSubscriptionId, tier (enum: free/pro/employer/recruiter/enterprise), status (active/past_due/cancelled), currentPeriodStart, currentPeriodEnd, seats (for recruiter/employer), timestamps |
| `subscription.controller.ts` | Handlers: createCheckoutSession, getMySubscription, cancelSubscription, handleWebhook |
| `subscription.service.ts` | Create Stripe checkout sessions, manage subscription lifecycle, enforce tier limits, process webhook events |
| `subscription.repo.ts` | Extends `BaseRepo<Subscription>` — findByUserId, findByStripeCustomerId, findByStripeSubscriptionId |
| `subscription.routes.ts` | POST /checkout, GET /me, DELETE /cancel, POST /webhook (raw body) |
| `subscription.types.ts` | SubscriptionTier enum, CreateCheckoutInput, SubscriptionResponse, WebhookEvent |
| `subscription.validation.ts` | Zod schemas: createCheckoutSchema (tier required) |
| `stripe.webhook.ts` | Stripe webhook signature verification, event routing (checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.deleted) |

**Subscription Tiers:**

| Tier | Price | Features |
|------|-------|----------|
| free | $0 | QR code, profile, unlimited reviews, share publicly or keep private |
| pro | $5-10/mo | Analytics, downloadable reputation report, custom QR designs, video highlights reel |
| employer | $50-200/mo per location | Team reviews, top performers, internal leaderboard, retention signals |
| recruiter | $500-1000/mo per seat | Search by quality scores/industry/location, contact top-rated individuals |
| enterprise | Custom | API access, ATS integration, bulk data |

---

## Shared Layer: `/src/shared/`

| File | Purpose |
|------|---------|
| `errors/appError.ts` | `AppError` class extending Error — statusCode, isOperational, code. Standard error factory methods: badRequest, unauthorized, forbidden, notFound, conflict, internal |
| `db/base.repo.ts` | Generic `BaseRepo<TModel>` — findById, findOne, findAll, create, updateById, deleteById. All modules extend this. |
| `storage/gcs.ts` | GCS client wrapper — uploadFile, downloadFile, generateSignedUrl, deleteFile. Uses `@google-cloud/storage` |
| `storage/secrets.ts` | Secrets initialization (download config if ENABLE_S3=true), cleanup on shutdown |
| `utils.ts` | Shared utilities — hashPhone, generateSlug, generateUUID, paginateQuery, formatResponse |

---

## Middleware Layer: `/src/middleware/`

| File | Purpose |
|------|---------|
| `authenticate.ts` | Verify JWT from Authorization header, attach user claims to `req.user`. Supports both Firebase ID tokens and custom JWTs |
| `authorize.ts` | `requireRole(...roles)` middleware factory — checks `req.user.role` against allowed roles |
| `roles.ts` | Role constants and role hierarchy. `STANDARD_PROTECTED_ROLES`, `ADMIN_ROLES`, `PAID_ROLES` |
| `validate.ts` | `validate(schema)` middleware factory — validates `req.body` / `req.query` / `req.params` against Zod schema, returns 400 with structured errors |
| `rateLimit.ts` | Express rate limiter — default API limit, stricter limits for auth endpoints, review submission (anti-spam) |
| `auditLog.ts` | Log data access events — who accessed what, when, from where. For compliance and anti-fraud |
| `requestContext.ts` | Attach request ID, timestamp, IP to request object for tracing |
| `errorHandler.ts` | Global Express error handler — catches AppError and unhandled errors, formats JSON response, logs to Winston |

---

## Config Layer: `/src/config/`

| File | Purpose |
|------|---------|
| `env.ts` | Zod-validated environment variables. All env vars declared and typed here. Fails fast on missing required vars at startup |
| `appenv.ts` | Helper to resolve env vars with path expansion (~, $VAR), file existence checks |
| `logger.ts` | Winston logger — console transport (dev), JSON transport (prod). Log levels: error, warn, info, debug |
| `firebase.ts` | Firebase Admin SDK initialization — `initializeFirebase()` called in server.ts startup |
| `sequelize.ts` | Sequelize instance creation, `initDb()` / `shutdownDb()`, SSL config for Cloud SQL. Registers all models |
| `storage.ts` | GCS bucket configuration — bucket name from env, default signed URL expiry |
| `stripe.ts` | Stripe SDK initialization — API key from env, webhook secret |
| `swagger.ts` | Swagger/OpenAPI spec generation via swagger-jsdoc |

### env.ts variables

```typescript
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),

  // Database
  DATABASE_URL: z.string().optional(),
  POSTGRES_HOST: z.string().default("localhost"),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default("review_app"),
  POSTGRES_USER: z.string().default("review_user"),
  POSTGRES_PASSWORD: z.string().default("yourpassword"),

  // Auth
  JWT_SECRET: z.string().min(16),
  JWT_EXPIRATION_TIME_IN_MINUTES: z.coerce.number().default(60),
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_SERVICE_ACCOUNT_PATH: z.string().optional(),

  // GCS
  GCS_BUCKET_NAME: z.string(),
  GCS_PROJECT_ID: z.string(),
  SIGNED_URL_EXPIRY_MINUTES: z.coerce.number().default(60),

  // Stripe
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  STRIPE_PRO_PRICE_ID: z.string().optional(),
  STRIPE_EMPLOYER_PRICE_ID: z.string().optional(),
  STRIPE_RECRUITER_PRICE_ID: z.string().optional(),

  // SMS (for OTP)
  SMS_PROVIDER: z.enum(["twilio", "mock"]).default("mock"),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // App
  APP_BASE_URL: z.string().default("http://localhost:5173"),
  REVIEW_TOKEN_EXPIRY_HOURS: z.coerce.number().default(48),
  REVIEW_COOLDOWN_DAYS: z.coerce.number().default(7),

  // Logging
  ENABLE_HTTP_LOGGING: z.enum(["true", "false"]).default("false").transform(val => val === "true"),
});
```

---

## Database Layer: `/src/db/`

| File | Purpose |
|------|---------|
| `umzug.ts` | Umzug instance configured with Sequelize storage, migrations glob path |
| `migrate.ts` | `migrateUp()` function — runs pending migrations on server startup |
| `cli.ts` | CLI entry point for `npm run db:migrate` / `db:migrate:down` / `db:migrate:status` |
| `seed.ts` | Seed runner function |
| `seed-cli.ts` | CLI entry point for `npm run db:seed` / `db:seed:down` / `db:seed:status` |
| `migrations/` | Timestamped migration files (see directory tree above) |
| `seeds/` | Seed files for qualities and subscription tiers |

Migration naming convention: `YYYYMMDD-NNNN-description.ts` (matches iepapp pattern).

---

## Root Files

### package.json scripts

```json
{
  "name": "review-app-api",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file=.env src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "db:migrate": "tsx --env-file=.env src/db/cli.ts up",
    "db:migrate:down": "tsx --env-file=.env src/db/cli.ts down",
    "db:migrate:status": "tsx --env-file=.env src/db/cli.ts status",
    "db:seed": "tsx --env-file=.env src/db/seed-cli.ts up",
    "db:seed:down": "tsx --env-file=.env src/db/seed-cli.ts down",
    "db:seed:status": "tsx --env-file=.env src/db/seed-cli.ts status",
    "test": "vitest run",
    "test:watch": "vitest",
    "docs": "echo '\\n  API docs at http://localhost:3000/api-docs\\n'"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["src/db"]
}
```

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
});
```

### .env.example

```env
NODE_ENV=development
PORT=3000

# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=review_app
POSTGRES_USER=review_user
POSTGRES_PASSWORD=yourpassword

# Auth
JWT_SECRET=your-jwt-secret-min-16-chars
JWT_EXPIRATION_TIME_IN_MINUTES=60
FIREBASE_PROJECT_ID=your-firebase-project
FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json

# GCS
GCS_BUCKET_NAME=review-app-media
GCS_PROJECT_ID=your-gcp-project
SIGNED_URL_EXPIRY_MINUTES=60

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# SMS
SMS_PROVIDER=mock
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# App
APP_BASE_URL=http://localhost:5173
REVIEW_TOKEN_EXPIRY_HOURS=48
REVIEW_COOLDOWN_DAYS=7

ENABLE_HTTP_LOGGING=false
```

### Dockerfile

Three-stage build (matches iepapp pattern):

1. **deps** — `node:23-alpine`, copy `package*.json`, `npm ci` with cache mount
2. **build** — copy source + tsconfig, `npm run build`, `npm prune --omit=dev`
3. **runner** — `node:23-alpine`, non-root user, copy dist + node_modules, `CMD ["node", "dist/server.js"]`

Exposes port 8080 (Cloud Run default).

---

## app.ts Route Mounting

Following the iepapp pattern, `app.ts` mounts routes on a versioned router:

```
/health                         — healthRouter (public)
/api-docs                       — Swagger UI (public)
/api/v1/auth                    — authRouter (public)
/api/v1/profiles                — profileRouter (public read, auth write)
/api/v1/reviews                 — reviewRouter (public submit after OTP, public read)
/api/v1/media                   — mediaRouter (auth)
/api/v1/organizations           — organizationRouter (auth)
/api/v1/qualities               — qualityRouter (public)
/api/v1/recruiter               — recruiterRouter (auth + recruiter role)
/api/v1/employer                — employerRouter (auth + employer role)
/api/v1/verification            — verificationRouter (public)
/api/v1/references              — referenceRouter (auth)
/api/v1/subscriptions           — subscriptionRouter (auth + webhook public)
```

Protected routes use the middleware chain: `authenticate -> requireRole(...) -> auditLog(...)` (same pattern as iepapp).

---

## Key Patterns Carried from iepapp

1. **Module file convention:** `{module}.model.ts`, `{module}.controller.ts`, `{module}.service.ts`, `{module}.repo.ts`, `{module}.routes.ts`, `{module}.types.ts`, `{module}.validation.ts`
2. **BaseRepo generic class** in `shared/db/base.repo.ts` — all repos extend it
3. **Zod validation** at the middleware level via `validate(schema)` before controller
4. **AppError class** with factory methods for structured error responses
5. **Firebase Admin SDK** for auth token verification, custom JWT for internal API auth
6. **Sequelize 6 + Umzug** for ORM and migrations (no `sync()`, migrations only)
7. **GCS signed URLs** for media access (never expose raw bucket paths)
8. **Express 5 Router** with versioned API prefix (`/api/v1/`)
9. **Winston logger** with structured JSON logging
10. **Three-stage Dockerfile** for minimal production images
11. **tsx watch** for development, compiled `node dist/server.js` for production
12. **Vitest + Supertest** for unit/integration/e2e testing
