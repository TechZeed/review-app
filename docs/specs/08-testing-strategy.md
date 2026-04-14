# Spec 08: Testing Strategy

**Product:** Every Individual is a Brand -- Portable Individual Review App
**Author:** Muthukumaran Navaneethakrishnan
**Date:** 2026-04-14
**Status:** Draft
**Reference:** iepapp/apps/api/ test patterns (Vitest + Supertest + Faker)
**PRD refs:** All PRDs -- this spec covers testing for every module defined in Specs 01-07.

---

## 1. Test Infrastructure

### 1.1 Core Stack

| Tool | Version | Purpose |
|------|---------|---------|
| Vitest | ^3.x | Test runner, assertions, mocking |
| Supertest | ^7.x | HTTP endpoint testing (integration/e2e) |
| @faker-js/faker | ^9.x | Realistic test data generation |
| testcontainers | ^11.x | Ephemeral Postgres instances for integration tests |

These match the iepapp reference project exactly.

### 1.2 Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/utils/setup.ts"],
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/e2e/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/modules/**", "src/middleware/**", "src/shared/**"],
      exclude: [
        "src/**/*.types.ts",
        "src/**/*.validation.ts",
        "src/config/**",
        "src/db/migrations/**",
        "src/db/seeds/**",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
```

### 1.3 Test Database Setup

Integration and e2e tests use **testcontainers** to spin up an ephemeral Postgres instance per test suite. This avoids shared state between test runs and eliminates the need for a dedicated test database server.

```typescript
// tests/utils/testDb.ts
import { PostgreSqlContainer, StartedPostgreSqlContainer } from "testcontainers";
import { Sequelize } from "sequelize";
import { migrateUp } from "../../src/db/migrate.js";
import { registerModels } from "../../src/config/sequelize.js";

let container: StartedPostgreSqlContainer;
let sequelize: Sequelize;

export async function setupTestDb(): Promise<Sequelize> {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("review_app_test")
    .withUsername("test_user")
    .withPassword("test_password")
    .withExposedPorts(5432)
    .start();

  sequelize = new Sequelize({
    dialect: "postgres",
    host: container.getHost(),
    port: container.getMappedPort(5432),
    database: "review_app_test",
    username: "test_user",
    password: "test_password",
    logging: false,
  });

  registerModels(sequelize);
  await migrateUp(sequelize);
  return sequelize;
}

export async function teardownTestDb(): Promise<void> {
  if (sequelize) await sequelize.close();
  if (container) await container.stop();
}

export async function truncateAllTables(sequelize: Sequelize): Promise<void> {
  const tables = [
    "fraud_flags", "review_media", "otp_attempts",
    "reviews", "review_tokens", "references",
    "contact_requests", "profile_views",
    "organization_members", "organizations",
    "quality_scores", "subscriptions",
    "profiles", "users",
  ];
  for (const table of tables) {
    await sequelize.query(`TRUNCATE TABLE ${table} CASCADE`);
  }
}
```

**For unit tests:** No database. All repos and external services are mocked with `vi.mock()`.

**For integration tests:** One testcontainer per describe block. Tables are truncated between individual tests via `beforeEach`.

**For e2e tests:** One testcontainer per suite. Data builds up across test steps within a single flow.

### 1.4 Firebase Auth Mocking Strategy

Firebase Admin SDK is never called in tests. The `firebase-admin` module is globally mocked.

```typescript
// tests/utils/setup.ts — global mock
vi.mock("firebase-admin", () => ({
  initializeApp: vi.fn(),
  credential: { cert: vi.fn() },
  auth: () => ({
    verifyIdToken: vi.fn(),
    getUser: vi.fn(),
    createUser: vi.fn(),
    deleteUser: vi.fn(),
  }),
}));
```

The `mockFirebaseAuth` helper (Section 10) overrides `verifyIdToken` per test to return a controlled decoded token:

```typescript
import { auth } from "firebase-admin";

export function mockFirebaseAuth(user: {
  uid: string;
  email: string;
  phone?: string;
}): void {
  const mockAuth = auth();
  vi.mocked(mockAuth.verifyIdToken).mockResolvedValue({
    uid: user.uid,
    email: user.email,
    phone_number: user.phone,
    aud: "test-project",
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: `https://securetoken.google.com/test-project`,
    sub: user.uid,
    firebase: { sign_in_provider: "password", identities: {} },
  } as any);
}
```

### 1.5 GCP Storage Mocking Strategy

GCS is mocked at the module level. No real uploads happen in tests.

```typescript
// tests/utils/setup.ts — global mock
vi.mock("@google-cloud/storage", () => {
  const mockFile = {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi.fn().mockResolvedValue(["https://storage.example.com/signed-url"]),
    exists: vi.fn().mockResolvedValue([true]),
    createReadStream: vi.fn().mockReturnValue(new Readable({ read() { this.push(null); } })),
  };
  const mockBucket = {
    file: vi.fn().mockReturnValue(mockFile),
    upload: vi.fn().mockResolvedValue([mockFile]),
  };
  return {
    Storage: vi.fn().mockImplementation(() => ({
      bucket: vi.fn().mockReturnValue(mockBucket),
    })),
  };
});
```

The `mockGCSUpload` helper resets and configures mock behavior per test:

```typescript
export function mockGCSUpload(options?: {
  shouldFail?: boolean;
  signedUrl?: string;
}): void {
  const { Storage } = require("@google-cloud/storage");
  const storage = new Storage();
  const bucket = storage.bucket("test-bucket");
  const file = bucket.file("test-file");

  if (options?.shouldFail) {
    vi.mocked(file.save).mockRejectedValue(new Error("Upload failed"));
  } else {
    vi.mocked(file.save).mockResolvedValue(undefined);
    vi.mocked(file.getSignedUrl).mockResolvedValue([
      options?.signedUrl ?? "https://storage.example.com/signed-url",
    ]);
  }
}
```

### 1.6 Stripe Mocking Strategy

Stripe is mocked at the SDK level. No real Stripe API calls in tests.

```typescript
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: vi.fn().mockResolvedValue({
            id: "cs_test_123",
            url: "https://checkout.stripe.com/test",
          }),
        },
      },
      subscriptions: {
        retrieve: vi.fn(),
        update: vi.fn(),
        cancel: vi.fn(),
      },
      customers: {
        create: vi.fn().mockResolvedValue({ id: "cus_test_123" }),
      },
      webhooks: {
        constructEvent: vi.fn(),
      },
    })),
  };
});
```

### 1.7 Twilio/OTP Mocking Strategy

Twilio Verify API is mocked. The `SMS_PROVIDER` env var is set to `"mock"` in tests.

```typescript
vi.mock("twilio", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      verify: {
        v2: {
          services: vi.fn().mockReturnValue({
            verifications: {
              create: vi.fn().mockResolvedValue({ status: "pending", sid: "VE_test_123" }),
            },
            verificationChecks: {
              create: vi.fn().mockResolvedValue({ status: "approved", valid: true }),
            },
          }),
        },
      },
    })),
  };
});
```

The `mockTwilioVerify` helper controls OTP outcomes:

```typescript
export function mockTwilioVerify(options?: {
  sendStatus?: "pending" | "failed";
  verifyStatus?: "approved" | "pending" | "canceled";
}): void {
  const twilio = require("twilio");
  const client = twilio();
  const service = client.verify.v2.services("test-sid");

  vi.mocked(service.verifications.create).mockResolvedValue({
    status: options?.sendStatus ?? "pending",
    sid: "VE_test_123",
  });

  vi.mocked(service.verificationChecks.create).mockResolvedValue({
    status: options?.verifyStatus ?? "approved",
    valid: (options?.verifyStatus ?? "approved") === "approved",
  });
}
```

---

## 2. Test Structure

```
apps/api/tests/
├── unit/                                    — pure logic, no I/O
│   ├── auth.service.test.ts
│   ├── profile.service.test.ts
│   ├── review.service.test.ts
│   ├── verification.service.test.ts
│   ├── quality.service.test.ts
│   ├── media.service.test.ts
│   ├── organization.service.test.ts
│   ├── reference.service.test.ts
│   ├── recruiter.service.test.ts
│   ├── employer.service.test.ts
│   ├── subscription.service.test.ts
│   ├── fraud-score.test.ts
│   ├── pattern-detection.test.ts
│   ├── middleware/
│   │   ├── authenticate.test.ts
│   │   ├── authorize.test.ts
│   │   ├── validate.test.ts
│   │   ├── rateLimit.test.ts
│   │   ├── auditLog.test.ts
│   │   ├── requestContext.test.ts
│   │   └── errorHandler.test.ts
│   └── shared/
│       ├── appError.test.ts
│       ├── base.repo.test.ts
│       ├── gcs.test.ts
│       └── utils.test.ts
├── integration/                             — API endpoint tests with real DB
│   ├── auth.test.ts
│   ├── profile.test.ts
│   ├── review.test.ts
│   ├── verification.test.ts
│   ├── media.test.ts
│   ├── organization.test.ts
│   ├── quality.test.ts
│   ├── reference.test.ts
│   ├── recruiter.test.ts
│   ├── employer.test.ts
│   └── subscription.test.ts
├── e2e/                                     — full flow tests
│   ├── review-flow.test.ts
│   ├── recruiter-flow.test.ts
│   └── individual-upgrade-flow.test.ts
└── utils/                                   — shared test infrastructure
    ├── setup.ts                             — global mocks, env vars
    ├── factories.ts                         — test data generators
    └── testDb.ts                            — testcontainers setup/teardown
```

---

## 3. Coverage Targets

| Scope | Target | Rationale |
|-------|--------|-----------|
| **Overall** | 80% minimum | Baseline for production confidence |
| **Critical paths** (review flow, anti-fraud, verification) | 95% | Revenue-critical and trust-critical paths |
| **Services** (`*.service.ts`) | 85% | Core business logic lives here |
| **Controllers** (`*.controller.ts`) | 75% | Thin layer; most logic delegated to services |
| **Middleware** (`middleware/*.ts`) | 90% | Security boundary; every branch matters |
| **Repos** (`*.repo.ts`) | 70% | Thin wrappers over Sequelize; covered indirectly by integration tests |
| **Shared utilities** (`shared/**`) | 90% | Used everywhere; regressions cascade |

Coverage is enforced in CI via `vitest --coverage`. PRs that drop below thresholds fail the check.

---

## 4. Unit Tests -- Per Module

All unit tests mock every external dependency (repos, external SDKs, other services). They test pure business logic in isolation.

### 4.1 Auth Module (`tests/unit/auth.service.test.ts`)

**Register:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid registration with email, displayName, firebaseUid | User created in DB, custom JWT returned with correct claims |
| 2 | Duplicate email (email already exists in DB) | `409 Conflict` error thrown |
| 3 | Duplicate firebaseUid (UID already exists) | `409 Conflict` error thrown |
| 4 | Invalid email format | Validation rejects before service is called |
| 5 | Missing required fields (no email) | Validation rejects with structured error |
| 6 | Missing required fields (no displayName) | Validation rejects with structured error |
| 7 | Missing required fields (no firebaseUid) | Validation rejects with structured error |
| 8 | Role assignment: default role is `INDIVIDUAL` | Created user has role = INDIVIDUAL |
| 9 | Role assignment: admin can set role to EMPLOYER | Created user has role = EMPLOYER |
| 10 | Role assignment: admin can set role to RECRUITER | Created user has role = RECRUITER |
| 11 | Role assignment: non-admin cannot set role | `403 Forbidden` error thrown |

**Login:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 12 | Valid Firebase ID token, existing user | JWT returned with correct sub, role, status |
| 13 | Valid Firebase ID token, first-time user (auto-register) | User created with INDIVIDUAL role, JWT returned |
| 14 | Invalid Firebase ID token (verification fails) | `401 Unauthorized` error thrown |
| 15 | Expired Firebase ID token | `401 Unauthorized` error thrown |
| 16 | Valid token but account status = suspended | `403 Forbidden` ("Account suspended") |
| 17 | Valid token but account status = deactivated | `403 Forbidden` ("Account deactivated") |

**JWT:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 18 | Token generation with valid payload | JWT contains sub, email, role, iat, exp |
| 19 | Token verification with valid token and correct secret | Decoded payload matches original |
| 20 | Token verification with expired token | Throws `TokenExpiredError` |
| 21 | Token verification with invalid secret | Throws `JsonWebTokenError` |
| 22 | Token verification with malformed token string | Throws `JsonWebTokenError` |
| 23 | Token expiry matches `JWT_EXPIRATION_TIME_IN_MINUTES` config | exp - iat equals configured minutes |
| 24 | Token includes tier claim for INDIVIDUAL users with Pro subscription | `tier: "pro"` present in claims |
| 25 | Token omits tier claim for non-INDIVIDUAL roles | `tier` field is undefined |

---

### 4.2 Profile Module (`tests/unit/profile.service.test.ts`)

**Create:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid profile creation (headline, industry, location) | Profile created with auto-generated slug, QR code URL populated |
| 2 | Duplicate slug (collision on auto-generation) | Service retries slug generation, unique slug assigned |
| 3 | Auto-generate QR code on profile creation | `qrcode` package called with `https://{domain}/r/{slug}`, PNG uploaded to GCS |
| 4 | Slug uniqueness enforced at DB constraint level | DB constraint error caught and re-thrown as `409 Conflict` |
| 5 | User already has a profile (one profile per user) | `409 Conflict` ("Profile already exists") |
| 6 | Profile created with default visibility = `public` | Visibility field defaults to `public` |
| 7 | Profile counters initialized to zero | `total_reviews`, all quality counts = 0 |

**Update:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 8 | Valid update (headline, industry, location) | Fields updated, other fields unchanged |
| 9 | Unauthorized update (userId does not match profile owner) | `403 Forbidden` |
| 10 | Visibility change: public to private | Visibility updated to `private` |
| 11 | Visibility change: public to recruiter-only | Visibility updated to `recruiter-only` |
| 12 | Cannot update slug (slug is immutable) | Slug field ignored in update, original slug preserved |
| 13 | Cannot update totalReviews (read-only aggregate) | totalReviews field ignored in update |
| 14 | Admin can update any profile | Update succeeds regardless of userId match |

**QR Generation:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 15 | QR encodes correct URL: `https://{domain}/r/{slug}` | Encoded data matches expected URL |
| 16 | QR uses error correction level H | `qrcode` called with `errorCorrectionLevel: 'H'` |
| 17 | QR output is PNG format, minimum 300x300px | Buffer is valid PNG, dimensions correct |
| 18 | QR PNG uploaded to GCS at correct path | GCS upload called with `qr/{profileId}/qr.png` |
| 19 | Regenerate QR replaces existing QR URL | Old GCS file deleted, new URL stored on profile |
| 20 | GCS upload failure rolls back QR URL update | Profile qrCodeUrl unchanged, error propagated |

---

### 4.3 Review Module (`tests/unit/review.service.test.ts`)

**Scan (token generation):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid slug, valid device fingerprint | Review token created, profile data returned |
| 2 | Invalid slug (profile not found) | `404 Not Found` |
| 3 | Missing device fingerprint parameter | `400 Bad Request` |
| 4 | Token generated with correct expiry (48 hours) | `expires_at = scanned_at + 48h` |
| 5 | Device fingerprint stored as SHA-256 hash | Hash stored, not raw fingerprint |
| 6 | GPS coordinates stored when provided | `gps_latitude` and `gps_longitude` populated |
| 7 | GPS coordinates null when not provided | Fields are null, no error |
| 8 | Response includes all five qualities | Qualities list contains expertise, care, delivery, initiative, trust |

**Submit:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 9 | Valid submission: phone verified, 1 quality pick | Review created, token marked as used, profile counters incremented |
| 10 | Valid submission: phone verified, 2 quality picks | Review created with both picks, both quality counters incremented |
| 11 | Expired token (past 48h window) | `410 Gone` |
| 12 | Already used token (review already submitted) | `409 Conflict` |
| 13 | Token not phone-verified (status = pending) | `403 Forbidden` ("Phone verification required") |
| 14 | Invalid quality picks: 3 picks submitted | `422 Unprocessable Entity` |
| 15 | Invalid quality picks: 0 picks submitted (empty array) | `422 Unprocessable Entity` |
| 16 | Invalid quality picks: unknown quality name | `422 Unprocessable Entity` |
| 17 | Invalid quality picks: duplicate quality in array | `422 Unprocessable Entity` |
| 18 | Valid quality picks: exactly 1 pick | Review created successfully |
| 19 | Valid quality picks: exactly 2 picks | Review created successfully |
| 20 | Fraud score calculated and stored on review | `fraud_score` field is populated (0-100 integer) |
| 21 | Badge type assigned based on fraud score | `badge_type` matches score threshold |
| 22 | Profile aggregate counters incremented atomically | Counter queries use atomic increment (not read-modify-write) |
| 23 | Token not found (invalid UUID) | `404 Not Found` |

**Quality Picks Validation (detailed):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 24 | `["expertise"]` | Valid |
| 25 | `["care", "trust"]` | Valid |
| 26 | `["expertise", "care", "delivery"]` | Rejected: more than 2 |
| 27 | `[]` | Rejected: fewer than 1 |
| 28 | `["expertise", "expertise"]` | Rejected: duplicates |
| 29 | `["kindness"]` | Rejected: not a valid quality name |
| 30 | `["EXPERTISE"]` | Rejected: case-sensitive, must be lowercase |
| 31 | `[null]` | Rejected: null values |
| 32 | `"expertise"` (string, not array) | Rejected: wrong type |

---

### 4.4 Verification Module (`tests/unit/verification.service.test.ts`)

**OTP Send:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid phone number, valid review token | OTP sent via Twilio, `otp_attempts` row created |
| 2 | Invalid review token (not found) | `404 Not Found` |
| 3 | Expired review token | `410 Gone` |
| 4 | Token already phone-verified (status = phone_verified) | `409 Conflict` |
| 5 | Token already used (status = used) | `409 Conflict` |
| 6 | Same phone reviewed this profile within 7 days | `429 Too Many Requests` with retry-after date |
| 7 | Same phone reviewed this profile 8 days ago (outside window) | OTP sent successfully |
| 8 | Device rate limit: 3+ distinct phones from same device in 30 days | `429 Too Many Requests` |
| 9 | Device rate limit: 2 distinct phones from same device (under limit) | OTP sent successfully |
| 10 | OTP lockout: `locked_until` in the future | `429 Too Many Requests` with retry-after time |
| 11 | Invalid phone number format (not E.164) | `422 Unprocessable Entity` |
| 12 | Phone hash computed with per-profile salt | Hash differs for same phone across different profiles |
| 13 | Twilio API failure | `502 Bad Gateway` or service error propagated |

**OTP Verify:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 14 | Valid OTP code (Twilio returns approved) | Token status updated to `phone_verified`, phone_verified_at set |
| 15 | Invalid OTP code (Twilio returns not approved) | `401 Unauthorized`, attempt_count incremented |
| 16 | Expired OTP code (Twilio returns canceled/expired) | `401 Unauthorized` |
| 17 | 3 failed attempts: locked for 15 minutes | `locked_until` set to now + 15 min, `429` returned |
| 18 | 6 failed attempts: locked for 24 hours | `locked_until` set to now + 24h, `429` returned |
| 19 | Verify after lockout expires | Verification proceeds normally |
| 20 | Review token not found | `404 Not Found` |
| 21 | Review token expired | `410 Gone` |
| 22 | OTP already verified for this token | `409 Conflict` |

---

### 4.5 Media Module (`tests/unit/media.service.test.ts`)

**Upload:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid text submission (100 chars) | Media record created with `media_type = text`, `processing_status = complete` |
| 2 | Valid voice file (WebM Opus, 10 seconds, 500KB) | File uploaded to GCS, media record with `processing_status = pending` |
| 3 | Valid video file (WebM, 20 seconds, 15MB) | File uploaded to GCS, media record with `processing_status = pending` |
| 4 | Oversized voice file (> 2MB) | `413 Payload Too Large` |
| 5 | Oversized video file (> 50MB) | `413 Payload Too Large` |
| 6 | Review not found | `404 Not Found` |
| 7 | Upload window expired (> 10 minutes after review submission) | `410 Gone` ("Upload window expired") |
| 8 | Media already attached to this review | `409 Conflict` |
| 9 | Fraud score updated: +5 points after media attachment | Review `fraud_score` incremented by 5 |
| 10 | Badge type potentially upgraded after media score boost | If score crosses threshold, badge_type updated |

**Text:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 11 | Exactly 280 characters | Accepted |
| 12 | 281 characters | `422 Unprocessable Entity` ("Max 280 characters") |
| 13 | Empty text string | `422 Unprocessable Entity` ("Content required") |
| 14 | Text with only whitespace | `422 Unprocessable Entity` |
| 15 | Text with unicode characters (emoji, CJK) | Accepted, character count is correct |

**Voice:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 16 | 15 seconds duration (at max limit) | Accepted |
| 17 | 16 seconds duration (over max) | `422 Unprocessable Entity` ("Max 15 seconds") |
| 18 | 2 seconds duration (at min limit) | Accepted |
| 19 | 1 second duration (under min) | `422 Unprocessable Entity` ("Min 2 seconds") |
| 20 | Invalid format (MP3 instead of WebM) | `422 Unprocessable Entity` ("Invalid format") |
| 21 | GCS upload failure | Error propagated, no media record created |

**Video:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 22 | 30 seconds duration (at max limit) | Accepted |
| 23 | 31 seconds duration (over max) | `422 Unprocessable Entity` ("Max 30 seconds") |
| 24 | 3 seconds duration (at min limit) | Accepted |
| 25 | 2 seconds duration (under min) | `422 Unprocessable Entity` ("Min 3 seconds") |
| 26 | Valid WebM format | Accepted |
| 27 | Valid MP4 format | Accepted |
| 28 | Invalid format (AVI) | `422 Unprocessable Entity` |
| 29 | GCS upload failure | Error propagated, no media record created |

---

### 4.6 Organization Module (`tests/unit/organization.service.test.ts`)

**Create:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid organization (name, domain) | Organization created with UUID |
| 2 | Duplicate name | `409 Conflict` |
| 3 | Duplicate domain | `409 Conflict` |
| 4 | Missing required field (name) | Validation error |
| 5 | Organization created with logo upload to GCS | `logoUrl` populated with signed URL |

**Tag (link profile to org):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 6 | Valid tag: individual tags themselves to an org | `OrganizationMember` record created with status = active |
| 7 | Already tagged to this org | `409 Conflict` ("Already a member") |
| 8 | Self-tag prevention: org cannot force-tag an individual | `403 Forbidden` (only individual or admin can tag) |
| 9 | Tag with title and startDate | Fields populated correctly |
| 10 | Multiple orgs: individual tagged to org A and org B | Both membership records exist |
| 11 | Employer tags individual (request flow, not direct tag) | Tag request created, pending individual approval |

**Untag (individual removes org):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 12 | Valid untag by individual | Membership status = former, endDate set |
| 13 | Reviews persist after untag | Reviews remain associated with profile, not org |
| 14 | Untag by non-owner | `403 Forbidden` |
| 15 | Untag from org not tagged to | `404 Not Found` |
| 16 | Profile remains fully functional after untag | Profile accessible, QR still works |

---

### 4.7 Quality Module (`tests/unit/quality.service.test.ts`)

**Aggregation:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Single review with 1 pick: expertise count = 1 | Profile `expertise_count` = 1 |
| 2 | Single review with 2 picks: both counters incremented | Both quality counts = 1 |
| 3 | 10 reviews, 7 pick expertise: expertise percentage = 70% | Percentage calculated as `(7/10) * 100` |
| 4 | 0 reviews: all percentages = 0 | No division by zero, all zeros |
| 5 | Percentage recalculated on new review | Percentages reflect latest totals |
| 6 | Counter increments are idempotent (no double-counting) | Same review processed twice does not double-increment |

**Heat Map:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 7 | Distribution after 5 reviews with varied picks | Heat map shows correct count per quality |
| 8 | Distribution after 50 reviews | Percentages stable, sum of pick counts >= 50 (some reviews have 2 picks) |
| 9 | All reviews pick same quality | That quality = 100%, others = 0% |
| 10 | Even distribution across all 5 qualities | Each approximately 20% (within rounding) |

**Signature Strength (badge threshold):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 11 | Quality at 40%+ with 20+ picks: earns "signature" badge | `isSignature = true` for that quality |
| 12 | Quality at 40%+ with 19 picks: no badge (insufficient volume) | `isSignature = false` |
| 13 | Quality at 39% with 20+ picks: no badge (insufficient percentage) | `isSignature = false` |
| 14 | Multiple qualities can be signatures simultaneously | Both flagged as signatures |
| 15 | Signature status recalculated on each new review | Badges update dynamically |

---

### 4.8 Verification / Anti-Fraud Module (`tests/unit/fraud-score.test.ts`)

**Fraud Score Calculation:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | All layers passed: valid token + GPS + OTP + fresh phone + quick use + no device flags + no anomalies | Score = 95 (100 possible only with media, which is post-submission) |
| 2 | No OTP verification (should not happen in production, but defensive) | Score = 95 - 25 - 5 = 65 |
| 3 | No GPS location captured | Score = 95 - 10 = 85 |
| 4 | Token used > 1 hour after scan | Score = 95 - 10 = 85 |
| 5 | Device flagged for rapid reviews | Score = 95 - 10 = 85 |
| 6 | Pattern anomalies detected | Score = 95 - 5 = 90 |
| 7 | No GPS + device flagged + pattern anomalies | Score = 95 - 10 - 10 - 5 = 70 |
| 8 | Minimum possible score (only valid token) | Score = 30 |
| 9 | Media attached: adds +5 to existing score | Score increases by 5, capped at 100 |
| 10 | Score never exceeds 100 | Even with all bonuses, max is 100 |
| 11 | Score never goes below 0 | Edge case: all penalties applied, floor is 0 |

**Pattern Detection (`tests/unit/pattern-detection.test.ts`):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 12 | Device velocity: 3+ reviews from same device in 1 hour | `device_velocity` flag created, severity = high |
| 13 | Device velocity: 2 reviews from same device in 1 hour | No flag |
| 14 | Phone velocity: 5+ reviews from same phone in 24 hours (across different profiles) | `phone_velocity` flag created, severity = high |
| 15 | Phone velocity: 4 reviews from same phone in 24 hours | No flag |
| 16 | Quality pattern: 10+ consecutive reviews with identical quality picks for same profile | `quality_pattern` flag created, severity = medium |
| 17 | Profile spike: 20+ reviews for same profile in 1 hour (unusual volume) | `profile_spike` flag created, severity = high |
| 18 | Profile spike: 5 reviews for same profile in 1 hour (normal) | No flag |
| 19 | Location cluster: 10+ reviews from within 50m radius in 1 hour for different profiles | `location_cluster` flag created, severity = medium |
| 20 | Text similarity: 3+ reviews with >90% text overlap for same profile | `text_similarity` flag created, severity = medium |
| 21 | Multiple flags on single review: all flags created | All applicable fraud_flags rows inserted |
| 22 | Flag severity correctly assigned per type | High for velocity/spike, medium for patterns |

**Badge Assignment:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 23 | Score >= 80, no media: badge = `verified_interaction` | Correct badge type |
| 24 | Score >= 80, with media: badge = `verified_testimonial` | Upgraded badge for media |
| 25 | Score 50-79: badge = `standard` | Standard badge |
| 26 | Score 30-49: badge = `low_confidence` | Low confidence badge |
| 27 | Score < 30: badge = `held`, review is held for manual review | `is_held = true` |
| 28 | Any high-severity fraud flag: review is held regardless of score | `is_held = true` even if score > 30 |

**Token Validation:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 29 | Valid token (exists, not expired, not used) | Returns token data |
| 30 | Expired token (past 48h) | Returns expired status |
| 31 | Already used token | Returns used status |
| 32 | Tampered token (hash mismatch) | `404 Not Found` |
| 33 | Non-existent token UUID | `404 Not Found` |

---

### 4.9 Reference Module (`tests/unit/reference.service.test.ts`)

**Opt-In:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid opt-in: reviewer consents after submitting a review | Reference record created with `consentGivenAt` timestamp |
| 2 | Opt-in with name, phone, email | All contact fields encrypted and stored |
| 3 | Duplicate opt-in for same review | `409 Conflict` ("Already opted in for this review") |
| 4 | Opt-in for a review that does not exist | `404 Not Found` |
| 5 | Opt-in for a review by a different reviewer (tamper attempt) | `403 Forbidden` |

**Withdraw (Revoke Consent):**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 6 | Valid withdrawal | `consentRevoked = true`, contact info no longer accessible |
| 7 | Already withdrawn | `409 Conflict` ("Already revoked") |
| 8 | Withdrawal by non-reviewer (wrong user) | `403 Forbidden` |
| 9 | After withdrawal: recruiter contact requests blocked | Contact request returns `403` ("Reference unavailable") |

**Contact Request:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 10 | Valid contact request by recruiter (paid tier) | Contact request created, contactCount incremented |
| 11 | Contact request by non-recruiter role (e.g., individual) | `403 Forbidden` ("Recruiter access required") |
| 12 | Contact request for revoked reference | `403 Forbidden` ("Reference unavailable") |
| 13 | Rate limited: recruiter exceeds daily contact limit | `429 Too Many Requests` |
| 14 | Raw contact info never exposed in response | Response contains mediated contact method, not raw phone/email |
| 15 | Contact request by employer (valid for their tagged individuals) | Contact request created |

---

### 4.10 Recruiter Module (`tests/unit/recruiter.service.test.ts`)

**Search:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Search by quality (e.g., "expertise" >= 60%) | Returns profiles where expertise percentage >= 60 |
| 2 | Search by industry | Returns profiles matching industry filter |
| 3 | Search by location | Returns profiles matching location filter |
| 4 | Combined filters: quality + industry + location | AND logic applied, intersection returned |
| 5 | Search returns only public and recruiter-only profiles | Private profiles excluded |
| 6 | Search results paginated (default 20 per page) | Response includes total count, page, pageSize |
| 7 | Empty search results | Returns empty array, 200 status |
| 8 | Search by multiple qualities | Profiles must meet all quality thresholds |

**Profile Access:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 9 | Paid tier recruiter views a profile | ProfileView record created, full profile data returned |
| 10 | Free tier attempt to view profile | `403 Forbidden` ("Paid subscription required") |
| 11 | Private profile access attempt | `404 Not Found` (treated as if profile does not exist) |
| 12 | View history tracked per recruiter | ProfileView records accumulate |

**Contact:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 13 | Valid contact request with message | ContactRequest created with status = pending |
| 14 | Rate limited: exceeds 10 contact requests per day | `429 Too Many Requests` |
| 15 | Contact request for non-existent profile | `404 Not Found` |
| 16 | Duplicate contact request for same profile (within 30 days) | `409 Conflict` |

---

### 4.11 Employer Module (`tests/unit/employer.service.test.ts`)

**Dashboard:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Team aggregate: 5 members, average quality scores computed | Correct averages per quality |
| 2 | Team aggregate: member with 0 reviews included | Zero-review member does not skew averages (excluded or counted as 0) |
| 3 | Top performers ranking: sorted by total reviews descending | Correct ordering |
| 4 | Top performers ranking: tie-breaking by newest review date | Correct secondary sort |
| 5 | Dashboard date range filter | Only reviews within range counted |
| 6 | Empty team (no consented members) | Dashboard returns empty data, 200 status |

**Team Access:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 7 | Only consented profiles visible | Non-consented members excluded from all queries |
| 8 | Member revokes consent: immediately hidden from dashboard | Real-time consent enforcement |
| 9 | Employer from org A cannot see org B team | `403 Forbidden` or empty results |

**Retention Signals:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 10 | Velocity drop detection: individual averaged 4 reviews/week, now 1/week for 3 weeks | Retention signal flagged |
| 11 | Steady velocity: consistent review rate | No signal |
| 12 | New employee (< 4 weeks): not enough data for signal | No signal generated |
| 13 | Velocity drop calculation uses rolling 4-week windows | Correct windowing logic |

---

### 4.12 Subscription Module (`tests/unit/subscription.service.test.ts`)

**Checkout:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid checkout session for Pro tier | Stripe `checkout.sessions.create` called with correct price ID |
| 2 | Valid checkout session for Employer tier | Correct price ID and metadata |
| 3 | Valid checkout session for Recruiter tier | Correct price ID and metadata |
| 4 | Invalid tier name | `422 Unprocessable Entity` |
| 5 | User already has active subscription for this tier | `409 Conflict` |
| 6 | Checkout URL returned in response | `url` field populated |

**Webhook:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 7 | `checkout.session.completed` event | Subscription record created, tier activated |
| 8 | `invoice.paid` event | Subscription period extended, status = active |
| 9 | `customer.subscription.updated` event | Subscription record updated |
| 10 | `customer.subscription.deleted` event | Status set to cancelled |
| 11 | `invoice.payment_failed` event | Status set to past_due |
| 12 | Invalid webhook signature | `400 Bad Request` |
| 13 | Duplicate event (idempotency) | No duplicate processing, 200 returned |
| 14 | Unknown event type | Ignored gracefully, 200 returned |

**Tier Enforcement:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 15 | Recruiter feature (search) with no subscription | `403 Forbidden` ("Subscription required") |
| 16 | Recruiter feature with active recruiter subscription | Access granted |
| 17 | Employer feature (dashboard) with no subscription | `403 Forbidden` |
| 18 | Employer feature with active employer subscription | Access granted |
| 19 | Individual Pro feature (analytics) with free tier | `403 Forbidden` ("Pro subscription required") |
| 20 | Individual Pro feature with active Pro subscription | Access granted |
| 21 | Subscription expired (past_due for > 7 days) | Access revoked |
| 22 | Subscription cancelled mid-period: access until period end | Access granted until `currentPeriodEnd` |

---

### 4.13 Middleware Tests (`tests/unit/middleware/`)

**authenticate.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | Valid Bearer token | `req.user` populated with decoded claims, `next()` called |
| 2 | Missing Authorization header | `401 Unauthorized` |
| 3 | Malformed Authorization header (no "Bearer" prefix) | `401 Unauthorized` |
| 4 | Expired JWT | `401 Unauthorized` with "Token expired" message |
| 5 | Invalid JWT signature | `401 Unauthorized` |
| 6 | Empty token string | `401 Unauthorized` |

**authorize.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 7 | User role matches required role | `next()` called |
| 8 | User role does not match required role | `403 Forbidden` |
| 9 | Multiple required roles: user has one of them | `next()` called |
| 10 | Admin role bypasses all role checks | `next()` called |
| 11 | No user on request (authenticate not run) | `401 Unauthorized` |

**validate.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 12 | Valid body against Zod schema | `next()` called, `req.body` unchanged |
| 13 | Invalid body: missing required field | `400 Bad Request` with structured errors |
| 14 | Invalid body: wrong type | `400 Bad Request` with field-level error |
| 15 | Validates query params when configured | `req.query` validated |
| 16 | Validates path params when configured | `req.params` validated |
| 17 | Extra fields stripped (Zod strict mode) | Unknown fields removed from `req.body` |

**rateLimit.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 18 | Under rate limit | Request proceeds |
| 19 | At rate limit boundary | Request proceeds (boundary is inclusive) |
| 20 | Over rate limit | `429 Too Many Requests` with Retry-After header |
| 21 | Different rate limits for auth vs. general endpoints | Auth endpoint limit lower than general |

**errorHandler.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 22 | AppError with statusCode 400 | JSON response with status 400, error message |
| 23 | AppError with statusCode 500 | JSON response with status 500, generic message (no leak) |
| 24 | Unhandled Error (non-AppError) | JSON response with status 500, "Internal Server Error" |
| 25 | Error logged to Winston | Logger called with error details |
| 26 | Stack trace included in development, omitted in production | Conditional stack trace exposure |

**auditLog.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 27 | Audit log entry created for protected route access | Log entry includes userId, resource, action, timestamp, IP |
| 28 | Audit log skipped for public routes | No log entry created |

**requestContext.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 29 | Request ID generated and attached | `req.requestId` is a valid UUID |
| 30 | Request timestamp attached | `req.requestTimestamp` is a valid Date |
| 31 | Client IP attached | `req.clientIp` is populated |

---

### 4.14 Shared Utilities (`tests/unit/shared/`)

**appError.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 1 | `AppError.badRequest("msg")` creates error with statusCode 400 | Correct statusCode and message |
| 2 | `AppError.unauthorized("msg")` creates error with statusCode 401 | Correct statusCode and message |
| 3 | `AppError.forbidden("msg")` creates error with statusCode 403 | Correct statusCode and message |
| 4 | `AppError.notFound("msg")` creates error with statusCode 404 | Correct statusCode and message |
| 5 | `AppError.conflict("msg")` creates error with statusCode 409 | Correct statusCode and message |
| 6 | `AppError.internal("msg")` creates error with statusCode 500 | Correct statusCode and message |
| 7 | `isOperational` is true for all factory-created errors | Can distinguish operational from programmer errors |
| 8 | AppError extends Error | `instanceof Error` is true |

**utils.ts:**

| # | Test Case | Expected Outcome |
|---|-----------|------------------|
| 9 | `hashPhone(phone)` produces consistent SHA-256 hex string | Same input always produces same hash |
| 10 | `hashPhone` with different phones produces different hashes | Collision-free for distinct inputs |
| 11 | `generateSlug()` produces 8-12 char URL-safe string | Matches `[a-z0-9]{8,12}` pattern |
| 12 | `generateSlug()` does not produce sequential outputs | Two consecutive calls produce different slugs |
| 13 | `generateUUID()` produces valid UUID v4 | Matches UUID v4 format |
| 14 | `paginateQuery(page, pageSize)` returns correct offset and limit | offset = (page - 1) * pageSize |
| 15 | `paginateQuery` with page 0 defaults to page 1 | offset = 0 |
| 16 | `formatResponse(data, meta)` wraps data in standard envelope | `{ data, meta }` structure |

---

## 5. Integration Tests

Integration tests use Supertest to make real HTTP requests against the Express app, backed by a real (testcontainer) Postgres database. External services (Firebase, GCS, Twilio, Stripe) remain mocked.

### 5.1 Full Review Flow (`tests/integration/review.test.ts`)

```
scan -> OTP send -> OTP verify -> submit -> media upload -> verify on profile
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | GET `/reviews/scan/:slug` -> POST `/verification/otp/send` -> POST `/verification/otp/verify` -> POST `/reviews/submit` -> POST `/media/upload` -> GET `/profiles/:slug` (verify review appears, quality scores updated) |
| 2 | Submit without OTP verification | Scan -> skip OTP -> attempt submit -> `403` |
| 3 | Submit with expired token | Scan -> wait (mock time past 48h) -> submit -> `410` |
| 4 | Double submission on same token | Complete flow -> resubmit with same token -> `409` |
| 5 | Review visible on public profile endpoint | Complete flow -> GET `/profiles/:slug` includes review count |

### 5.2 Full Registration Flow (`tests/integration/auth.test.ts`)

```
register -> create profile -> generate QR
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | POST `/auth/register` -> POST `/profiles` -> verify QR code URL in profile |
| 2 | Register then login | POST `/auth/register` -> POST `/auth/login` -> GET `/auth/me` -> verify user data |
| 3 | Duplicate registration | POST `/auth/register` -> same data again -> `409` |
| 4 | Login with suspended account | Register -> suspend via admin -> login -> `403` |

### 5.3 Profile Flow (`tests/integration/profile.test.ts`)

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Create and retrieve by slug | POST `/profiles` -> GET `/profiles/:slug` -> verify data matches |
| 2 | Update profile | POST `/profiles` -> PATCH `/profiles` -> GET `/profiles/:slug` -> verify updates |
| 3 | Visibility: private profile hidden from public | Create private profile -> GET `/profiles/:slug` as unauthenticated -> `404` |
| 4 | Visibility: recruiter-only visible to recruiter | Create recruiter-only profile -> GET as recruiter -> `200` |
| 5 | QR regeneration | POST `/profiles/qr/regenerate` -> verify new QR URL differs from old |

### 5.4 Recruiter Flow (`tests/integration/recruiter.test.ts`)

```
register -> subscribe -> search -> view profile -> contact
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | Register as recruiter -> activate subscription via mock webhook -> GET `/recruiter/search?quality=expertise` -> GET `/recruiter/profile/:id` -> POST `/recruiter/contact/:profileId` |
| 2 | Search without subscription | Register as recruiter -> search -> `403` |
| 3 | Search returns only visible profiles | Create public + private profiles -> search -> only public appears |
| 4 | Contact rate limiting | Send 10 contacts -> 11th -> `429` |

### 5.5 Employer Flow (`tests/integration/employer.test.ts`)

```
register -> subscribe -> view dashboard -> team details
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | Register as employer -> create org -> activate subscription -> tag individuals (with consent) -> GET `/employer/dashboard` -> verify team scores |
| 2 | Dashboard without subscription | Register -> GET `/employer/dashboard` -> `403` |
| 3 | Only consented members visible | Tag 3 individuals, 1 revokes consent -> dashboard shows 2 members |
| 4 | Cross-org isolation | Employer A creates org A, Employer B creates org B -> A cannot see B's team |

### 5.6 Reference Flow (`tests/integration/reference.test.ts`)

```
submit review -> opt-in -> recruiter requests contact
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | Complete review flow -> POST `/references/opt-in` -> recruiter POST `/references/:id/contact` -> verify contact count incremented |
| 2 | Revoke after opt-in | Opt-in -> DELETE `/references/:id/revoke` -> recruiter contact attempt -> `403` |
| 3 | Individual view references | Complete opt-in -> GET `/references/profile/:profileId` -> verify reference listed |

### 5.7 Anti-Fraud Flow (`tests/integration/verification.test.ts`)

```
rapid reviews from same device -> flags generated
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | 3 reviews from same device in 1 hour | Submit 3 reviews with same `dfp` hash -> verify `device_velocity` fraud flag created |
| 2 | Same phone for same profile within 7 days | Submit review -> attempt second OTP send for same phone+profile -> `429` |
| 3 | OTP lockout after 3 failures | Send OTP -> 3 wrong codes -> verify locked_until set -> attempt another verify -> `429` |
| 4 | Fraud score correctly calculated end-to-end | Submit review with GPS, quick use, clean device -> verify score >= 85 |

### 5.8 Subscription Flow (`tests/integration/subscription.test.ts`)

```
checkout -> webhook -> tier activated -> features unlocked
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Complete happy path | POST `/subscriptions/checkout` (Pro tier) -> simulate `checkout.session.completed` webhook -> GET `/subscriptions/me` -> verify tier = pro |
| 2 | Payment failure | Simulate `invoice.payment_failed` webhook -> verify status = past_due |
| 3 | Cancellation | Simulate `customer.subscription.deleted` webhook -> verify status = cancelled |
| 4 | Tier upgrade: free to pro | Checkout pro -> webhook -> verify analytics endpoint now accessible |

### 5.9 Organization / Portability Flow (`tests/integration/organization.test.ts`)

```
individual untags org -> reviews persist -> new org tagged
```

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Portability: reviews survive org untag | Tag profile to org -> submit reviews -> untag -> verify reviews still on profile |
| 2 | Re-tag to new org | Tag to org A -> untag -> tag to org B -> verify both membership records exist (A = former, B = active) |
| 3 | Org members list | Create org -> tag 3 individuals -> GET `/organizations/:orgId/members` -> verify 3 members |

### 5.10 Quality Scores Flow (`tests/integration/quality.test.ts`)

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Scores update after review | Submit review with `["expertise", "care"]` -> GET `/qualities/profile/:id` -> verify expertise and care counts incremented |
| 2 | Percentages calculated correctly | Submit 10 reviews with varied picks -> GET scores -> verify percentages match expected distribution |
| 3 | Public access to quality scores | GET `/qualities/profile/:id` without auth -> `200` with scores |

### 5.11 Media Flow (`tests/integration/media.test.ts`)

| # | Test Case | Steps |
|---|-----------|-------|
| 1 | Text media attached to review | Submit review -> POST `/media/upload` with text -> verify media record linked |
| 2 | Upload window enforcement | Submit review -> advance time 11 minutes -> POST `/media/upload` -> `410` |
| 3 | Duplicate media rejected | Upload media -> upload again for same review -> `409` |

---

## 6. E2E Tests

E2E tests exercise full user journeys spanning multiple modules. They use the same testcontainer database and mocked external services but test the complete request chain.

### 6.1 Customer Scans QR and Leaves Review (`tests/e2e/review-flow.test.ts`)

```
Customer scans QR -> leaves review -> individual sees it on dashboard
```

**Steps:**

1. Register an individual user and create a profile (fixtures).
2. Simulate QR scan: `GET /reviews/scan/:slug` with device fingerprint.
3. Send OTP: `POST /verification/otp/send` with phone number.
4. Verify OTP: `POST /verification/otp/verify` with correct code.
5. Submit review: `POST /reviews/submit` with `quality_picks: ["care", "expertise"]`.
6. Upload text media: `POST /media/upload` with `review_id` and text content.
7. As the individual: `GET /profiles/me` -> verify `total_reviews` incremented, quality scores updated.
8. Public profile check: `GET /profiles/:slug` -> verify review count visible, badge type shown.
9. Verify fraud score is >= 80 (all layers passed in clean flow).

### 6.2 Recruiter Search and Contact (`tests/e2e/recruiter-flow.test.ts`)

```
Recruiter searches -> finds profile -> sends contact request
```

**Steps:**

1. Create 3 individual profiles with varied quality scores (fixtures).
2. Register a recruiter and activate subscription via mock webhook.
3. Search: `GET /recruiter/search?quality=expertise&min_score=50` -> verify matching profiles returned.
4. View profile: `GET /recruiter/profile/:id` -> verify full profile data with quality breakdown.
5. Contact: `POST /recruiter/contact/:profileId` with message -> verify request created.
6. Verify ProfileView record created for the viewed profile.
7. Verify contact request appears in individual's pending contacts.

### 6.3 Individual Upgrades to Pro (`tests/e2e/individual-upgrade-flow.test.ts`)

```
Individual upgrades to Pro -> sees analytics -> downloads report
```

**Steps:**

1. Register an individual, create profile, receive several reviews (fixtures).
2. Verify analytics endpoint returns `403` (free tier).
3. Create checkout: `POST /subscriptions/checkout` with tier = pro.
4. Simulate webhook: `checkout.session.completed`.
5. Verify subscription active: `GET /subscriptions/me` -> tier = pro, status = active.
6. Access analytics: GET analytics endpoint -> `200` with data.
7. Verify JWT now includes `tier: "pro"` claim on next login.

---

## 7. Test Helpers & Fixtures (`tests/utils/factories.ts`)

### 7.1 Factory Functions

```typescript
import { faker } from "@faker-js/faker";

/**
 * Creates a user record in the test database with Firebase mock configured.
 * Returns the user record and a valid JWT for authenticated requests.
 */
export async function createTestUser(
  role: "INDIVIDUAL" | "EMPLOYER" | "RECRUITER" | "ADMIN" = "INDIVIDUAL",
  overrides?: Partial<UserAttributes>,
): Promise<{ user: User; token: string }>;

/**
 * Creates a profile with auto-generated slug and QR code URL.
 * Requires an existing user (or creates one).
 */
export async function createTestProfile(
  overrides?: Partial<ProfileAttributes>,
): Promise<{ profile: Profile; user: User; token: string }>;

/**
 * Creates a complete review with quality picks and verification data.
 * Handles the full scan -> OTP -> submit pipeline internally.
 */
export async function createTestReview(
  profileId: string,
  overrides?: {
    qualityPicks?: string[];
    fraudScore?: number;
    badgeType?: string;
    withMedia?: boolean;
  },
): Promise<{ review: Review; reviewToken: ReviewToken }>;

/**
 * Creates an organization with optional logo URL.
 */
export async function createTestOrg(
  overrides?: Partial<OrganizationAttributes>,
): Promise<Organization>;

/**
 * Generates a valid, unexpired review token for a profile.
 * Does NOT go through the full scan endpoint -- directly inserts the token.
 */
export async function generateReviewToken(
  profileId: string,
  overrides?: {
    deviceFingerprint?: string;
    gpsLatitude?: number;
    gpsLongitude?: number;
    status?: "pending" | "phone_verified" | "used" | "expired";
    expiresAt?: Date;
  },
): Promise<ReviewToken>;

/**
 * Creates a subscription record for a user.
 */
export async function createTestSubscription(
  userId: string,
  tier: "free" | "pro" | "employer" | "recruiter" | "enterprise",
  overrides?: Partial<SubscriptionAttributes>,
): Promise<Subscription>;
```

### 7.2 Mock Helpers

```typescript
/**
 * Configures Firebase Admin SDK mock to accept a specific user's token.
 * Call in beforeEach when testing authenticated endpoints.
 */
export function mockFirebaseAuth(user: {
  uid: string;
  email: string;
  phone?: string;
}): void;

/**
 * Configures GCS mock for upload operations.
 * Defaults to successful upload. Pass shouldFail: true for error testing.
 */
export function mockGCSUpload(options?: {
  shouldFail?: boolean;
  signedUrl?: string;
}): void;

/**
 * Configures Twilio Verify mock for OTP operations.
 * Defaults to successful send + approved verification.
 */
export function mockTwilioVerify(options?: {
  sendStatus?: "pending" | "failed";
  verifyStatus?: "approved" | "pending" | "canceled";
}): void;

/**
 * Configures Stripe mock for checkout and webhook operations.
 */
export function mockStripeCheckout(options?: {
  sessionUrl?: string;
  shouldFail?: boolean;
}): void;

/**
 * Advances time for testing token expiry and time-window logic.
 * Uses vi.useFakeTimers / vi.setSystemTime.
 */
export function advanceTime(ms: number): void;

/**
 * Generates a valid Stripe webhook event payload with correct signature.
 */
export function createStripeWebhookEvent(
  type: string,
  data: Record<string, unknown>,
): { payload: string; signature: string };
```

### 7.3 Shared Faker Factories

```typescript
/**
 * Generates realistic fake data for test records.
 */
export const fakeUser = (role?: AppUserRole) => ({
  email: faker.internet.email(),
  displayName: faker.person.fullName(),
  firebaseUid: faker.string.uuid(),
  phone: faker.phone.number("+1##########"),
  role: role ?? "INDIVIDUAL",
  status: "active",
});

export const fakeProfile = () => ({
  headline: faker.person.jobTitle(),
  industry: faker.commerce.department(),
  location: `${faker.location.city()}, ${faker.location.state()}`,
  visibility: "public" as const,
});

export const fakeReview = () => ({
  qualityPicks: faker.helpers.arrayElements(
    ["expertise", "care", "delivery", "initiative", "trust"],
    { min: 1, max: 2 },
  ),
});

export const fakeOrg = () => ({
  name: faker.company.name(),
  domain: faker.internet.domainName(),
});

export const fakeDeviceFingerprint = () =>
  faker.string.hexadecimal({ length: 64, prefix: "" });

export const fakePhoneNumber = () =>
  faker.phone.number("+1##########");
```

---

## 8. Global Test Setup (`tests/utils/setup.ts`)

```typescript
import { beforeAll, afterAll, vi } from "vitest";

// Set test environment variables before any module loads
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-minimum-16-chars";
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.GCS_BUCKET_NAME = "test-bucket";
process.env.GCS_PROJECT_ID = "test-project";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.SMS_PROVIDER = "mock";
process.env.APP_BASE_URL = "http://localhost:5173";
process.env.REVIEW_TOKEN_EXPIRY_HOURS = "48";
process.env.REVIEW_COOLDOWN_DAYS = "7";

// Global mocks for external services
vi.mock("firebase-admin", () => ({ /* ... as Section 1.4 */ }));
vi.mock("@google-cloud/storage", () => ({ /* ... as Section 1.5 */ }));
vi.mock("stripe", () => ({ /* ... as Section 1.6 */ }));
vi.mock("twilio", () => ({ /* ... as Section 1.7 */ }));

// Suppress Winston logging in tests
vi.mock("../../src/config/logger.js", () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
```

---

## 9. CI Integration

### 9.1 GitHub Actions Test Job

```yaml
# .github/workflows/ci.yml (test job excerpt)
test:
  runs-on: ubuntu-latest
  services:
    # No external services needed -- testcontainers handles Postgres
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 23
        cache: npm
        cache-dependency-path: apps/api/package-lock.json
    - run: npm ci
      working-directory: apps/api
    - run: npm run test -- --coverage
      working-directory: apps/api
    - name: Upload coverage report
      uses: actions/upload-artifact@v4
      with:
        name: coverage-report
        path: apps/api/coverage/
```

### 9.2 Test Scripts in `package.json`

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "vitest run tests/e2e",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## 10. Test Naming Conventions

All tests follow a consistent naming pattern:

```typescript
describe("AuthService", () => {
  describe("register", () => {
    it("should create user and return JWT for valid registration", async () => { /* ... */ });
    it("should throw 409 for duplicate email", async () => { /* ... */ });
  });
});
```

- `describe` blocks match the service/module name.
- Nested `describe` blocks match the method/function name.
- `it` blocks start with `should` and describe the expected outcome.
- Test file names match the pattern: `{module}.service.test.ts` (unit) or `{module}.test.ts` (integration).

---

## 11. Test Data Isolation

| Concern | Strategy |
|---------|----------|
| Database state | `truncateAllTables()` in `beforeEach` for integration tests |
| Time-dependent logic | `vi.useFakeTimers()` / `vi.setSystemTime()` for token expiry, rate limits |
| Random data | Faker with optional seed (`faker.seed(12345)`) for reproducible failures |
| Mock state | `vi.clearAllMocks()` in `afterEach` to prevent mock bleed between tests |
| Environment variables | Set in `setup.ts`, never modified per-test (override via `vi.stubEnv()` when needed) |
| File system | Never write to disk; GCS mocked, multer uses memory storage |

---

## 12. Test Count Summary

| Category | Estimated Test Count |
|----------|---------------------|
| Unit: Auth | 25 |
| Unit: Profile | 20 |
| Unit: Review | 32 |
| Unit: Verification / Anti-Fraud | 33 |
| Unit: Media | 29 |
| Unit: Organization | 16 |
| Unit: Quality | 15 |
| Unit: Reference | 15 |
| Unit: Recruiter | 16 |
| Unit: Employer | 13 |
| Unit: Subscription | 22 |
| Unit: Middleware | 31 |
| Unit: Shared | 16 |
| **Unit Total** | **~283** |
| Integration | ~35 |
| E2E | ~3 flows (~25 assertions) |
| **Grand Total** | **~320+ test cases** |
