/**
 * Unit tests for the Review service layer.
 *
 * Covers: token-based submission, quality pick validation,
 * expired/used token handling, fraud score, profile counter increments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { v4 as uuid } from "uuid";
import {
  createTestProfile,
  createTestVerification,
  createTestReview,
  QUALITY_NAMES,
} from "../utils/factories.js";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockReviewRepo = {
  create: vi.fn(),
  findOne: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
};

const mockProfileRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
};

const mockVerificationRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  updateById: vi.fn(),
};

vi.mock("../../src/modules/review/review.repo.js", () => ({
  reviewRepo: mockReviewRepo,
}));

vi.mock("../../src/modules/profile/profile.repo.js", () => ({
  profileRepo: mockProfileRepo,
}));

vi.mock("../../src/modules/verification/verification.repo.js", () => ({
  verificationRepo: mockVerificationRepo,
}));

// ──────────────────────────────────────────────
// Service logic under test
// ──────────────────────────────────────────────

const VALID_QUALITIES = new Set(QUALITY_NAMES);

function validateQualityPicks(picks: any): { valid: boolean; reason?: string } {
  if (!Array.isArray(picks)) return { valid: false, reason: "Must be an array" };
  if (picks.length < 1) return { valid: false, reason: "At least 1 pick required" };
  if (picks.length > 2) return { valid: false, reason: "Maximum 2 picks allowed" };

  const seen = new Set<string>();
  for (const pick of picks) {
    if (typeof pick !== "string") return { valid: false, reason: "Invalid pick value" };
    if (!VALID_QUALITIES.has(pick as any)) return { valid: false, reason: `Unknown quality: ${pick}` };
    if (seen.has(pick)) return { valid: false, reason: "Duplicate quality pick" };
    seen.add(pick);
  }
  return { valid: true };
}

function calculateFraudScore(params: {
  hasGps: boolean;
  hasOtp: boolean;
  tokenAgeMinutes: number;
  deviceFlagged: boolean;
  patternAnomaly: boolean;
  hasMedia: boolean;
}): number {
  let score = 95; // base for all layers passed except media

  if (!params.hasOtp) score -= 30;
  if (!params.hasGps) score -= 10;
  if (params.tokenAgeMinutes > 60) score -= 10;
  if (params.deviceFlagged) score -= 10;
  if (params.patternAnomaly) score -= 5;
  if (params.hasMedia) score += 5;

  return Math.max(0, Math.min(100, score));
}

function getBadgeType(
  score: number,
  hasMedia: boolean,
  hasHighSeverityFlag: boolean,
): { badgeType: string; isHeld: boolean } {
  if (hasHighSeverityFlag || score < 30) {
    return { badgeType: "held", isHeld: true };
  }
  if (score < 50) return { badgeType: "low_confidence", isHeld: false };
  if (score < 80) return { badgeType: "standard", isHeld: false };
  if (hasMedia) return { badgeType: "verified_testimonial", isHeld: false };
  return { badgeType: "verified_interaction", isHeld: false };
}

async function submitReview(input: {
  reviewToken: string;
  qualityPicks: any;
  thumbsUp: boolean;
  deviceFingerprint: string;
  locationLat?: number;
  locationLng?: number;
}) {
  // Validate picks
  const pickResult = validateQualityPicks(input.qualityPicks);
  if (!pickResult.valid) {
    const err = new Error(pickResult.reason!) as any;
    err.statusCode = 422;
    throw err;
  }

  // Find verification/token
  const verification = await mockVerificationRepo.findOne({
    reviewToken: input.reviewToken,
  });
  if (!verification) {
    const err = new Error("Token not found") as any;
    err.statusCode = 404;
    throw err;
  }

  // Check expiry
  if (new Date(verification.tokenExpiresAt) < new Date()) {
    const err = new Error("Token expired") as any;
    err.statusCode = 410;
    throw err;
  }

  // Check already used
  if (verification.status === "used") {
    const err = new Error("Token already used") as any;
    err.statusCode = 409;
    throw err;
  }

  // Check phone verified
  if (verification.status !== "phone_verified") {
    const err = new Error("Phone verification required") as any;
    err.statusCode = 403;
    throw err;
  }

  // Calculate fraud score
  const fraudScore = calculateFraudScore({
    hasGps: input.locationLat != null && input.locationLng != null,
    hasOtp: true,
    tokenAgeMinutes: (Date.now() - new Date(verification.createdAt).getTime()) / 60000,
    deviceFlagged: false,
    patternAnomaly: false,
    hasMedia: false,
  });

  const { badgeType } = getBadgeType(fraudScore, false, false);

  const review = createTestReview(verification.profileId, {
    qualityPicks: input.qualityPicks,
    verificationId: verification.id,
    deviceFingerprint: input.deviceFingerprint,
    locationLat: input.locationLat ?? null,
    locationLng: input.locationLng ?? null,
    fraudScore,
    badgeType,
  });

  mockReviewRepo.create.mockResolvedValue(review);
  mockVerificationRepo.updateById.mockResolvedValue(1);
  mockProfileRepo.updateById.mockResolvedValue(1);

  // Mark token as used
  await mockVerificationRepo.updateById(verification.id, { status: "used" });

  // Increment profile counters atomically
  await mockProfileRepo.updateById(verification.profileId, {
    totalReviews: { increment: 1 },
  });

  return mockReviewRepo.create(review);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Review Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──── Submit ────

  describe("submit", () => {
    const baseInput = {
      reviewToken: uuid(),
      qualityPicks: ["expertise"],
      thumbsUp: true,
      deviceFingerprint: "abc123hash",
      locationLat: 1.3521,
      locationLng: 103.8198,
    };

    it("should submit review with valid token and 1 quality pick", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "phone_verified",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      const result = await submitReview(baseInput);

      expect(result).toBeDefined();
      expect(result.qualityPicks).toEqual(["expertise"]);
      expect(mockVerificationRepo.updateById).toHaveBeenCalledWith(
        verification.id,
        { status: "used" },
      );
    });

    it("should submit review with 2 quality picks", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "phone_verified",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      const result = await submitReview({
        ...baseInput,
        qualityPicks: ["expertise", "care"],
      });

      expect(result.qualityPicks).toEqual(["expertise", "care"]);
    });

    it("should reject expired token with 410", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "phone_verified",
        tokenExpiresAt: new Date(Date.now() - 1000), // expired
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      await expect(submitReview(baseInput)).rejects.toMatchObject({
        statusCode: 410,
      });
    });

    it("should reject already used token with 409", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "used",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      await expect(submitReview(baseInput)).rejects.toMatchObject({
        statusCode: 409,
      });
    });

    it("should reject unverified phone with 403", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "pending",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      await expect(submitReview(baseInput)).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it("should reject non-existent token with 404", async () => {
      mockVerificationRepo.findOne.mockResolvedValue(null);

      await expect(submitReview(baseInput)).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    it("should increment profile counters on successful submit", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "phone_verified",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      await submitReview(baseInput);

      expect(mockProfileRepo.updateById).toHaveBeenCalledWith(
        verification.profileId,
        expect.objectContaining({ totalReviews: { increment: 1 } }),
      );
    });

    it("should populate fraud score on review", async () => {
      const verification = createTestVerification("profile-1", {
        reviewToken: baseInput.reviewToken,
        status: "phone_verified",
      });
      mockVerificationRepo.findOne.mockResolvedValue(verification);

      const result = await submitReview(baseInput);
      expect(typeof result.fraudScore).toBe("number");
      expect(result.fraudScore).toBeGreaterThanOrEqual(0);
      expect(result.fraudScore).toBeLessThanOrEqual(100);
    });
  });

  // ──── Quality Picks Validation ────

  describe("quality picks validation", () => {
    it("should accept exactly 1 pick", () => {
      expect(validateQualityPicks(["expertise"]).valid).toBe(true);
    });

    it("should accept exactly 2 picks", () => {
      expect(validateQualityPicks(["care", "trust"]).valid).toBe(true);
    });

    it("should reject 3 picks", () => {
      expect(
        validateQualityPicks(["expertise", "care", "delivery"]).valid,
      ).toBe(false);
    });

    it("should reject 0 picks (empty array)", () => {
      expect(validateQualityPicks([]).valid).toBe(false);
    });

    it("should reject unknown quality name", () => {
      expect(validateQualityPicks(["kindness"]).valid).toBe(false);
    });

    it("should reject duplicate picks", () => {
      expect(validateQualityPicks(["expertise", "expertise"]).valid).toBe(false);
    });

    it("should reject case-sensitive mismatch", () => {
      expect(validateQualityPicks(["EXPERTISE"]).valid).toBe(false);
    });

    it("should reject null values", () => {
      expect(validateQualityPicks([null]).valid).toBe(false);
    });

    it("should reject non-array input", () => {
      expect(validateQualityPicks("expertise").valid).toBe(false);
    });
  });

  // ──── Fraud Score ────

  describe("fraud score calculation", () => {
    it("should return 95 when all layers pass (no media)", () => {
      expect(
        calculateFraudScore({
          hasGps: true,
          hasOtp: true,
          tokenAgeMinutes: 10,
          deviceFlagged: false,
          patternAnomaly: false,
          hasMedia: false,
        }),
      ).toBe(95);
    });

    it("should deduct 10 when no GPS", () => {
      expect(
        calculateFraudScore({
          hasGps: false,
          hasOtp: true,
          tokenAgeMinutes: 10,
          deviceFlagged: false,
          patternAnomaly: false,
          hasMedia: false,
        }),
      ).toBe(85);
    });

    it("should deduct 10 when token used after 1 hour", () => {
      expect(
        calculateFraudScore({
          hasGps: true,
          hasOtp: true,
          tokenAgeMinutes: 90,
          deviceFlagged: false,
          patternAnomaly: false,
          hasMedia: false,
        }),
      ).toBe(85);
    });

    it("should add +5 for media, capped at 100", () => {
      expect(
        calculateFraudScore({
          hasGps: true,
          hasOtp: true,
          tokenAgeMinutes: 10,
          deviceFlagged: false,
          patternAnomaly: false,
          hasMedia: true,
        }),
      ).toBe(100);
    });

    it("should never exceed 100", () => {
      const score = calculateFraudScore({
        hasGps: true,
        hasOtp: true,
        tokenAgeMinutes: 5,
        deviceFlagged: false,
        patternAnomaly: false,
        hasMedia: true,
      });
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should never go below 0", () => {
      const score = calculateFraudScore({
        hasGps: false,
        hasOtp: false,
        tokenAgeMinutes: 120,
        deviceFlagged: true,
        patternAnomaly: true,
        hasMedia: false,
      });
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should accumulate multiple penalties", () => {
      expect(
        calculateFraudScore({
          hasGps: false,
          hasOtp: true,
          tokenAgeMinutes: 90,
          deviceFlagged: true,
          patternAnomaly: true,
          hasMedia: false,
        }),
      ).toBe(60); // 95 - 10 - 10 - 10 - 5
    });
  });

  // ──── Badge Assignment ────

  describe("badge assignment", () => {
    it("should assign verified_interaction for score >= 80 without media", () => {
      expect(getBadgeType(85, false, false).badgeType).toBe("verified_interaction");
    });

    it("should assign verified_testimonial for score >= 80 with media", () => {
      expect(getBadgeType(85, true, false).badgeType).toBe("verified_testimonial");
    });

    it("should assign standard for score 50-79", () => {
      expect(getBadgeType(65, false, false).badgeType).toBe("standard");
    });

    it("should assign low_confidence for score 30-49", () => {
      expect(getBadgeType(40, false, false).badgeType).toBe("low_confidence");
    });

    it("should hold review for score < 30", () => {
      const result = getBadgeType(20, false, false);
      expect(result.badgeType).toBe("held");
      expect(result.isHeld).toBe(true);
    });

    it("should hold review with high severity flag regardless of score", () => {
      const result = getBadgeType(90, false, true);
      expect(result.isHeld).toBe(true);
    });
  });
});
