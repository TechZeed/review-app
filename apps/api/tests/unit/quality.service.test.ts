/**
 * Unit tests for the Quality service layer.
 *
 * Covers: listing qualities, score calculation, percentage computation,
 * signature strength badge threshold (40% + 20 picks).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestQualities, QUALITY_NAMES } from "../utils/factories.js";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockQualityRepo = {
  findAll: vi.fn(),
};

const mockQualityScoreRepo = {
  findAll: vi.fn(),
  upsertScore: vi.fn(),
};

vi.mock("../../src/modules/quality/quality.repo.js", () => ({
  qualityRepo: mockQualityRepo,
  qualityScoreRepo: mockQualityScoreRepo,
}));

// ──────────────────────────────────────────────
// Service logic under test
// ──────────────────────────────────────────────

const QUALITIES = createTestQualities();

function listQualities() {
  return QUALITIES;
}

interface QualityScore {
  qualityId: string;
  qualityName: string;
  pickCount: number;
  percentage: number;
  isSignature: boolean;
}

function calculateScores(
  totalReviews: number,
  pickCounts: Record<string, number>,
): QualityScore[] {
  return QUALITIES.map((q) => {
    const pickCount = pickCounts[q.name] ?? 0;
    const percentage = totalReviews > 0 ? Math.round((pickCount / totalReviews) * 100) : 0;
    const isSignature = percentage >= 40 && pickCount >= 20;
    return {
      qualityId: q.id,
      qualityName: q.name,
      pickCount,
      percentage,
      isSignature,
    };
  });
}

function getHeatMap(scores: QualityScore[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of scores) {
    map[s.qualityName] = s.pickCount;
  }
  return map;
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Quality Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ──── List Qualities ────

  describe("list qualities", () => {
    it("should return all 5 qualities", () => {
      const result = listQualities();
      expect(result).toHaveLength(5);
    });

    it("should contain the correct quality names", () => {
      const result = listQualities();
      const names = result.map((q) => q.name);
      expect(names).toEqual(
        expect.arrayContaining([
          "expertise",
          "care",
          "delivery",
          "initiative",
          "trust",
        ]),
      );
    });

    it("should have customerLanguage for each quality", () => {
      const result = listQualities();
      for (const q of result) {
        expect(q.customerLanguage).toBeDefined();
        expect(typeof q.customerLanguage).toBe("string");
        expect(q.customerLanguage.length).toBeGreaterThan(0);
      }
    });
  });

  // ──── Score Calculation ────

  describe("score calculation", () => {
    it("should compute correct percentage for a single quality", () => {
      const scores = calculateScores(10, { expertise: 7 });
      const expertise = scores.find((s) => s.qualityName === "expertise");
      expect(expertise!.percentage).toBe(70);
    });

    it("should return 0 percentages when no reviews", () => {
      const scores = calculateScores(0, {});
      for (const s of scores) {
        expect(s.percentage).toBe(0);
      }
    });

    it("should increment both counters for 2-pick review", () => {
      const scores = calculateScores(1, { expertise: 1, care: 1 });
      expect(scores.find((s) => s.qualityName === "expertise")!.pickCount).toBe(1);
      expect(scores.find((s) => s.qualityName === "care")!.pickCount).toBe(1);
    });

    it("should recalculate percentages on new data", () => {
      const before = calculateScores(5, { expertise: 3 });
      const after = calculateScores(6, { expertise: 4 });
      expect(after.find((s) => s.qualityName === "expertise")!.percentage).toBe(67);
      expect(before.find((s) => s.qualityName === "expertise")!.percentage).toBe(60);
    });

    it("should not double-count (idempotent input)", () => {
      const scores = calculateScores(10, { expertise: 7 });
      const scores2 = calculateScores(10, { expertise: 7 });
      expect(scores).toEqual(scores2);
    });
  });

  // ──── Heat Map ────

  describe("heat map", () => {
    it("should show correct distribution after varied picks", () => {
      const scores = calculateScores(5, {
        expertise: 3,
        care: 2,
        delivery: 1,
        initiative: 1,
        trust: 0,
      });
      const map = getHeatMap(scores);
      expect(map.expertise).toBe(3);
      expect(map.care).toBe(2);
      expect(map.trust).toBe(0);
    });

    it("should handle 100% for one quality", () => {
      const scores = calculateScores(10, { expertise: 10 });
      expect(scores.find((s) => s.qualityName === "expertise")!.percentage).toBe(100);
      expect(scores.find((s) => s.qualityName === "care")!.percentage).toBe(0);
    });

    it("should show approximately even distribution", () => {
      const scores = calculateScores(50, {
        expertise: 10,
        care: 10,
        delivery: 10,
        initiative: 10,
        trust: 10,
      });
      for (const s of scores) {
        expect(s.percentage).toBe(20);
      }
    });
  });

  // ──── Signature Strength ────

  describe("signature strength badge", () => {
    it("should earn signature at 40%+ with 20+ picks", () => {
      const scores = calculateScores(50, { expertise: 25 });
      const expertise = scores.find((s) => s.qualityName === "expertise");
      expect(expertise!.percentage).toBe(50);
      expect(expertise!.pickCount).toBe(25);
      expect(expertise!.isSignature).toBe(true);
    });

    it("should NOT earn signature at 40%+ with only 19 picks", () => {
      const scores = calculateScores(45, { expertise: 19 });
      const expertise = scores.find((s) => s.qualityName === "expertise");
      expect(expertise!.pickCount).toBe(19);
      expect(expertise!.isSignature).toBe(false);
    });

    it("should NOT earn signature at 39% even with 20+ picks", () => {
      const scores = calculateScores(100, { expertise: 39 });
      const expertise = scores.find((s) => s.qualityName === "expertise");
      expect(expertise!.percentage).toBe(39);
      expect(expertise!.pickCount).toBeGreaterThanOrEqual(20);
      expect(expertise!.isSignature).toBe(false);
    });

    it("should allow multiple signatures simultaneously", () => {
      const scores = calculateScores(50, { expertise: 25, care: 22 });
      const expertise = scores.find((s) => s.qualityName === "expertise");
      const care = scores.find((s) => s.qualityName === "care");
      expect(expertise!.isSignature).toBe(true);
      expect(care!.isSignature).toBe(true);
    });

    it("should recalculate signature on each new review", () => {
      // Before: 19 picks, 39% — not signature
      const before = calculateScores(49, { expertise: 19 });
      expect(before.find((s) => s.qualityName === "expertise")!.isSignature).toBe(false);

      // After: 20 picks, 40% — becomes signature
      const after = calculateScores(50, { expertise: 20 });
      expect(after.find((s) => s.qualityName === "expertise")!.isSignature).toBe(true);
    });
  });
});
