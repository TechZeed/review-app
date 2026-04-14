/**
 * Global test setup — runs before every test file via vitest setupFiles.
 *
 * Responsibilities:
 *   1. Set test environment variables
 *   2. Mock Firebase Admin SDK
 *   3. Mock @google-cloud/storage
 *   4. Mock Stripe SDK
 *   5. Mock Twilio SDK
 */

import { vi, beforeAll, afterAll, afterEach } from "vitest";
import { Readable } from "node:stream";

// ──────────────────────────────────────────────
// 1. Environment variables (must run before any
//    module reads `process.env`)
// ──────────────────────────────────────────────

process.env.NODE_ENV = "test";
process.env.PORT = "3000";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
process.env.JWT_EXPIRATION_TIME_IN_MINUTES = "60";
process.env.FIREBASE_PROJECT_ID = "test-project";
process.env.GCP_BUCKET_NAME = "test-bucket";
process.env.GCP_PROJECT_ID = "test-project";
process.env.STRIPE_SECRET_KEY = "sk_test_fake_key_for_testing";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake_secret";
process.env.TWILIO_ACCOUNT_SID = "AC_test_sid";
process.env.TWILIO_AUTH_TOKEN = "test_auth_token";
process.env.TWILIO_VERIFY_SERVICE_SID = "VA_test_service_sid";
process.env.TWILIO_PHONE_NUMBER = "+15555550100";
process.env.POSTGRES_HOST = "localhost";
process.env.POSTGRES_PORT = "5432";
process.env.POSTGRES_DB = "review_app_test";
process.env.POSTGRES_USER = "test_user";
process.env.POSTGRES_PASSWORD = "test_password";
process.env.APP_URL = "http://localhost:3000";
process.env.FRONTEND_URL = "http://localhost:5173";
process.env.CORS_ORIGINS = "http://localhost:5173";

// ──────────────────────────────────────────────
// 2. Firebase Admin SDK mock
// ──────────────────────────────────────────────

vi.mock("firebase-admin", () => {
  const verifyIdToken = vi.fn();
  const getUser = vi.fn();
  const createUser = vi.fn();
  const deleteUser = vi.fn();

  const authInstance = {
    verifyIdToken,
    getUser,
    createUser,
    deleteUser,
  };

  return {
    default: {
      initializeApp: vi.fn(),
      credential: {
        cert: vi.fn(),
        applicationDefault: vi.fn(),
      },
      auth: vi.fn(() => authInstance),
      app: vi.fn(),
    },
    initializeApp: vi.fn(),
    credential: {
      cert: vi.fn(),
      applicationDefault: vi.fn(),
    },
    auth: vi.fn(() => authInstance),
  };
});

// ──────────────────────────────────────────────
// 3. @google-cloud/storage mock
// ──────────────────────────────────────────────

vi.mock("@google-cloud/storage", () => {
  const mockFile = {
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getSignedUrl: vi
      .fn()
      .mockResolvedValue(["https://storage.example.com/signed-url"]),
    exists: vi.fn().mockResolvedValue([true]),
    createReadStream: vi.fn().mockReturnValue(
      new Readable({
        read() {
          this.push(null);
        },
      }),
    ),
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

// ──────────────────────────────────────────────
// 4. Stripe SDK mock
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// 5. Twilio SDK mock
// ──────────────────────────────────────────────

vi.mock("twilio", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      verify: {
        v2: {
          services: vi.fn().mockReturnValue({
            verifications: {
              create: vi
                .fn()
                .mockResolvedValue({ status: "pending", sid: "VE_test_123" }),
            },
            verificationChecks: {
              create: vi
                .fn()
                .mockResolvedValue({ status: "approved", valid: true }),
            },
          }),
        },
      },
    })),
  };
});

// ──────────────────────────────────────────────
// 6. Suppress noisy loggers during tests
// ──────────────────────────────────────────────

vi.mock("../../src/config/logger.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ──────────────────────────────────────────────
// 7. Lifecycle hooks
// ──────────────────────────────────────────────

afterEach(() => {
  vi.restoreAllMocks();
});
