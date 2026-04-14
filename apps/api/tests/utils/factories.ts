/**
 * Test data factories — generate realistic objects for unit and integration tests.
 *
 * Every factory returns a plain object that matches the shape the service/repo
 * layer expects.  Override any field via the `overrides` parameter.
 */

import { faker } from "@faker-js/faker";
import { v4 as uuid } from "uuid";
import jwt from "jsonwebtoken";
import { vi } from "vitest";
import type { AppUserRole } from "../../src/middleware/roles.js";

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

export interface TestUser {
  id: string;
  firebaseUid: string;
  email: string;
  displayName: string;
  phone: string | null;
  role: AppUserRole;
  status: string;
  isApproved: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestUser(
  role: AppUserRole = "INDIVIDUAL",
  overrides: Partial<TestUser> = {},
): TestUser {
  return {
    id: uuid(),
    firebaseUid: `firebase_${faker.string.alphanumeric(28)}`,
    email: faker.internet.email().toLowerCase(),
    displayName: faker.person.fullName(),
    phone: faker.phone.number({ style: "international" }),
    role,
    status: "active",
    isApproved: true,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Profiles
// ──────────────────────────────────────────────

export interface TestProfile {
  id: string;
  userId: string;
  slug: string;
  headline: string;
  industry: string;
  location: string;
  avatarUrl: string | null;
  qrCodeUrl: string | null;
  visibility: "public" | "recruiter-only" | "private";
  totalReviews: number;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestProfile(
  overrides: Partial<TestProfile> = {},
): TestProfile {
  const id = overrides.id ?? uuid();
  return {
    id,
    userId: uuid(),
    slug: faker.string.alphanumeric(10).toLowerCase(),
    headline: faker.person.jobTitle(),
    industry: faker.commerce.department(),
    location: faker.location.city(),
    avatarUrl: null,
    qrCodeUrl: `https://storage.example.com/qr/${id}/qr.png`,
    visibility: "public",
    totalReviews: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Reviews
// ──────────────────────────────────────────────

export interface TestReview {
  id: string;
  profileId: string;
  reviewerPhone: string;
  qualityPicks: string[];
  thumbsUp: boolean;
  mediaId: string | null;
  verificationId: string;
  deviceFingerprint: string;
  locationLat: number | null;
  locationLng: number | null;
  tokenUsedAt: Date;
  fraudScore: number;
  badgeType: string;
  status: "active" | "flagged" | "removed";
  createdAt: Date;
  updatedAt: Date;
}

export function createTestReview(
  profileId: string,
  overrides: Partial<TestReview> = {},
): TestReview {
  return {
    id: uuid(),
    profileId,
    reviewerPhone: faker.string.hexadecimal({ length: 64, prefix: "" }),
    qualityPicks: ["expertise"],
    thumbsUp: true,
    mediaId: null,
    verificationId: uuid(),
    deviceFingerprint: faker.string.hexadecimal({ length: 64, prefix: "" }),
    locationLat: parseFloat(faker.location.latitude().toString()),
    locationLng: parseFloat(faker.location.longitude().toString()),
    tokenUsedAt: new Date(),
    fraudScore: 85,
    badgeType: "verified_interaction",
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Organizations
// ──────────────────────────────────────────────

export interface TestOrganization {
  id: string;
  name: string;
  domain: string;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestOrg(
  overrides: Partial<TestOrganization> = {},
): TestOrganization {
  return {
    id: uuid(),
    name: faker.company.name(),
    domain: faker.internet.domainName(),
    logoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Qualities (seeded data)
// ──────────────────────────────────────────────

export const QUALITY_NAMES = [
  "expertise",
  "care",
  "delivery",
  "initiative",
  "trust",
] as const;

export type QualityName = (typeof QUALITY_NAMES)[number];

export interface TestQuality {
  id: string;
  name: QualityName;
  label: string;
  description: string;
  customerLanguage: string;
  sortOrder: number;
}

const QUALITY_SEED: Omit<TestQuality, "id">[] = [
  {
    name: "expertise",
    label: "Expertise",
    description: "Domain expertise",
    customerLanguage: "Expert in their domain",
    sortOrder: 1,
  },
  {
    name: "care",
    label: "Care",
    description: "Customer care",
    customerLanguage: "Made me feel valued",
    sortOrder: 2,
  },
  {
    name: "delivery",
    label: "Delivery",
    description: "Promise delivery",
    customerLanguage: "Did exactly what they promised",
    sortOrder: 3,
  },
  {
    name: "initiative",
    label: "Initiative",
    description: "Goes above and beyond",
    customerLanguage: "Went beyond what I asked",
    sortOrder: 4,
  },
  {
    name: "trust",
    label: "Trust",
    description: "Trustworthiness",
    customerLanguage: "I'd come back to this person",
    sortOrder: 5,
  },
];

export function createTestQualities(): TestQuality[] {
  return QUALITY_SEED.map((q) => ({ id: uuid(), ...q }));
}

// ──────────────────────────────────────────────
// Verification / Review Tokens
// ──────────────────────────────────────────────

export interface TestVerification {
  id: string;
  phone: string | null;
  profileId: string;
  reviewToken: string;
  tokenExpiresAt: Date;
  deviceFingerprint: string;
  locationLat: number | null;
  locationLng: number | null;
  verifiedAt: Date | null;
  status: "pending" | "phone_verified" | "used" | "expired" | "flagged";
  attemptCount: number;
  lockedUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestVerification(
  profileId: string,
  overrides: Partial<TestVerification> = {},
): TestVerification {
  return {
    id: uuid(),
    phone: null,
    profileId,
    reviewToken: uuid(),
    tokenExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    deviceFingerprint: faker.string.hexadecimal({ length: 64, prefix: "" }),
    locationLat: parseFloat(faker.location.latitude().toString()),
    locationLng: parseFloat(faker.location.longitude().toString()),
    verifiedAt: null,
    status: "pending",
    attemptCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// Subscriptions
// ──────────────────────────────────────────────

export interface TestSubscription {
  id: string;
  userId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  tier: "free" | "pro" | "employer" | "recruiter" | "enterprise";
  status: "active" | "past_due" | "cancelled";
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  seats: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export function createTestSubscription(
  overrides: Partial<TestSubscription> = {},
): TestSubscription {
  const now = new Date();
  return {
    id: uuid(),
    userId: uuid(),
    stripeCustomerId: `cus_test_${faker.string.alphanumeric(14)}`,
    stripeSubscriptionId: `sub_test_${faker.string.alphanumeric(14)}`,
    tier: "free",
    status: "active",
    currentPeriodStart: now,
    currentPeriodEnd: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    seats: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// JWT helper — generate a signed review token
// ──────────────────────────────────────────────

export function generateReviewToken(
  profileId: string,
  expiresInSeconds: number = 48 * 60 * 60,
): string {
  return jwt.sign(
    { profileId, type: "review" },
    process.env.JWT_SECRET!,
    { expiresIn: expiresInSeconds },
  );
}

/**
 * Generate a valid auth JWT for a test user.
 */
export function generateAuthToken(
  user: Pick<TestUser, "id" | "email" | "role" | "status"> & { tier?: string },
): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      isApproved: true,
      ...(user.tier ? { tier: user.tier } : {}),
    },
    process.env.JWT_SECRET!,
    { algorithm: "HS256", expiresIn: "1h" },
  );
}

// ──────────────────────────────────────────────
// Mock helpers — per-test overrides for external
// services that are globally mocked in setup.ts
// ──────────────────────────────────────────────

/**
 * Override Firebase verifyIdToken to return a controlled decoded token.
 *
 * Because vi.mock("firebase-admin") intercepts ESM imports but not CJS require(),
 * we dynamically import the mocked module instead of using require().
 */
export async function mockFirebaseAuth(user: {
  uid: string;
  email: string;
  phone?: string;
}): Promise<void> {
  const admin = await import("firebase-admin");
  const authFn = (admin as any).default?.auth ?? (admin as any).auth;
  if (!authFn) return;
  const mockAuth = authFn();
  vi.mocked(mockAuth.verifyIdToken).mockResolvedValue({
    uid: user.uid,
    email: user.email,
    phone_number: user.phone,
    aud: "test-project",
    auth_time: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    iss: "https://securetoken.google.com/test-project",
    sub: user.uid,
    firebase: { sign_in_provider: "password", identities: {} },
  } as any);
}

/**
 * Configure GCS upload mock behaviour for a single test.
 */
export async function mockGCSUpload(options?: {
  shouldFail?: boolean;
  signedUrl?: string;
}): Promise<void> {
  const gcs = await import("@google-cloud/storage");
  const storage = new (gcs as any).Storage();
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

/**
 * Configure Twilio Verify mock behaviour for a single test.
 */
export async function mockTwilioVerify(options?: {
  sendStatus?: "pending" | "failed";
  verifyStatus?: "approved" | "pending" | "canceled";
}): Promise<void> {
  const twilio = await import("twilio");
  const client = (twilio as any).default();
  const service = client.verify.v2.services("test-sid");

  vi.mocked(service.verifications.create).mockResolvedValue({
    status: options?.sendStatus ?? "pending",
    sid: "VE_test_123",
  } as any);

  vi.mocked(service.verificationChecks.create).mockResolvedValue({
    status: options?.verifyStatus ?? "approved",
    valid: (options?.verifyStatus ?? "approved") === "approved",
  } as any);
}
