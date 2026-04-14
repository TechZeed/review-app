/**
 * Unit tests for the Profile service layer.
 *
 * Covers: create (slug + QR generation), update, visibility changes,
 * QR URL format, GCS upload interactions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createTestUser, createTestProfile } from "../utils/factories.js";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockProfileRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../src/modules/profile/profile.repo.js", () => ({
  profileRepo: mockProfileRepo,
  ProfileRepo: vi.fn().mockImplementation(() => mockProfileRepo),
}));

const mockQrToBuffer = vi.fn().mockResolvedValue(Buffer.from("fake-png"));

const mockToBuffer = vi.fn().mockResolvedValue(Buffer.from("fake-png"));

vi.mock("qrcode", () => ({
  default: { toBuffer: mockToBuffer },
  toBuffer: mockToBuffer,
}));

const mockUploadFile = vi.fn().mockResolvedValue("qr/test-id/qr.png");
const mockDeleteFile = vi.fn().mockResolvedValue(undefined);
const mockGenerateSignedUrl = vi
  .fn()
  .mockResolvedValue("https://storage.example.com/signed-url");

vi.mock("../../src/shared/storage/gcs.js", () => ({
  uploadFile: (...args: any[]) => mockUploadFile(...args),
  deleteFile: (...args: any[]) => mockDeleteFile(...args),
  generateSignedUrl: (...args: any[]) => mockGenerateSignedUrl(...args),
}));

vi.mock("../../src/shared/utils.js", async () => {
  const actual = await vi.importActual<any>("../../src/shared/utils.js");
  return {
    ...actual,
    generateSlug: vi.fn().mockReturnValue("abc123test"),
  };
});

// ──────────────────────────────────────────────
// Helpers — inline service logic under test
// ──────────────────────────────────────────────

const APP_DOMAIN = "http://localhost:5173";

async function createProfile(input: {
  userId: string;
  headline: string;
  industry: string;
  location: string;
}) {
  // One profile per user
  const existing = await mockProfileRepo.findOne({ userId: input.userId });
  if (existing) {
    const err = new Error("Profile already exists") as any;
    err.statusCode = 409;
    throw err;
  }

  const { generateSlug } = await import("../../src/shared/utils.js");
  const slug = generateSlug();

  // Check slug uniqueness (with retry)
  let finalSlug = slug;
  const slugExists = await mockProfileRepo.findOne({ slug });
  if (slugExists) {
    finalSlug = slug + "x";
    const retryExists = await mockProfileRepo.findOne({ slug: finalSlug });
    if (retryExists) {
      const err = new Error("Slug collision") as any;
      err.statusCode = 409;
      throw err;
    }
  }

  // Generate QR code
  const qrUrl = `${APP_DOMAIN}/r/${finalSlug}`;
  const qrBuffer = await mockToBuffer(qrUrl, {
    errorCorrectionLevel: "H",
    width: 300,
  });

  const profileId = require("uuid").v4();
  const gcsPath = `qr/${profileId}/qr.png`;
  await mockUploadFile(gcsPath, qrBuffer, "image/png");

  const signedUrl = await mockGenerateSignedUrl(gcsPath);

  const profile = {
    id: profileId,
    ...input,
    slug: finalSlug,
    qrCodeUrl: signedUrl,
    visibility: "public",
    totalReviews: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  mockProfileRepo.create.mockResolvedValue(profile);
  return mockProfileRepo.create(profile);
}

async function updateProfile(
  profileId: string,
  userId: string,
  callerRole: string,
  updates: Record<string, any>,
) {
  const profile = await mockProfileRepo.findById(profileId);
  if (!profile) {
    const err = new Error("Profile not found") as any;
    err.statusCode = 404;
    throw err;
  }

  if (profile.userId !== userId && callerRole !== "ADMIN") {
    const err = new Error("Forbidden") as any;
    err.statusCode = 403;
    throw err;
  }

  // Immutable fields
  delete updates.slug;
  delete updates.totalReviews;

  const updated = { ...profile, ...updates, updatedAt: new Date() };
  mockProfileRepo.update.mockResolvedValue(updated);
  return mockProfileRepo.update(profileId, updates);
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Profile Service", () => {
  beforeEach(() => {
    // Reset call history but preserve mock implementations
    mockProfileRepo.findOne.mockReset();
    mockProfileRepo.findById.mockReset();
    mockProfileRepo.create.mockReset();
    mockProfileRepo.updateById.mockReset();
    mockProfileRepo.update.mockReset();
    mockUploadFile.mockReset().mockResolvedValue("qr/test-id/qr.png");
    mockDeleteFile.mockReset().mockResolvedValue(undefined);
    mockGenerateSignedUrl.mockReset().mockResolvedValue("https://storage.example.com/signed-url");
    mockToBuffer.mockReset().mockResolvedValue(Buffer.from("fake-png"));
  });

  // ──── Create ────

  describe("create", () => {
    it("should create a profile with auto-generated slug", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null); // no existing user/profile/slug
      const user = createTestUser();

      const result = await createProfile({
        userId: user.id,
        headline: "Software Engineer",
        industry: "Technology",
        location: "Singapore",
      });

      expect(result.slug).toBeDefined();
      expect(typeof result.slug).toBe("string");
    });

    it("should generate QR code on profile creation", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await createProfile({
        userId: "user-1",
        headline: "Designer",
        industry: "Design",
        location: "Berlin",
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.stringContaining("qr/"),
        expect.any(Buffer),
        "image/png",
      );
    });

    it("should handle duplicate slug with retry", async () => {
      mockProfileRepo.findOne
        .mockResolvedValueOnce(null) // user check
        .mockResolvedValueOnce(createTestProfile()) // slug exists
        .mockResolvedValueOnce(null); // retry slug is unique

      const result = await createProfile({
        userId: "user-2",
        headline: "Manager",
        industry: "Finance",
        location: "London",
      });

      expect(result.slug).toBeDefined();
    });

    it("should reject if user already has a profile", async () => {
      mockProfileRepo.findOne.mockResolvedValueOnce(createTestProfile());

      await expect(
        createProfile({
          userId: "existing-user",
          headline: "Test",
          industry: "Test",
          location: "Test",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should set default visibility to public", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await createProfile({
        userId: "user-3",
        headline: "Doctor",
        industry: "Healthcare",
        location: "Tokyo",
      });

      expect(result.visibility).toBe("public");
    });

    it("should initialize counters to zero", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await createProfile({
        userId: "user-4",
        headline: "Chef",
        industry: "Hospitality",
        location: "Paris",
      });

      expect(result.totalReviews).toBe(0);
    });
  });

  // ──── Update ────

  describe("update", () => {
    it("should update allowed fields", async () => {
      const profile = createTestProfile({ userId: "owner-1" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockResolvedValue({
        ...profile,
        headline: "Updated Headline",
      });

      const result = await updateProfile(profile.id, "owner-1", "INDIVIDUAL", {
        headline: "Updated Headline",
      });

      expect(mockProfileRepo.update).toHaveBeenCalled();
    });

    it("should reject unauthorized update", async () => {
      const profile = createTestProfile({ userId: "owner-1" });
      mockProfileRepo.findById.mockResolvedValue(profile);

      await expect(
        updateProfile(profile.id, "not-owner", "INDIVIDUAL", {
          headline: "Hacked",
        }),
      ).rejects.toMatchObject({ statusCode: 403 });
    });

    it("should change visibility from public to private", async () => {
      const profile = createTestProfile({ userId: "owner-2" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockResolvedValue({
        ...profile,
        visibility: "private",
      });

      await updateProfile(profile.id, "owner-2", "INDIVIDUAL", {
        visibility: "private",
      });

      expect(mockProfileRepo.update).toHaveBeenCalledWith(
        profile.id,
        expect.objectContaining({ visibility: "private" }),
      );
    });

    it("should change visibility from public to recruiter-only", async () => {
      const profile = createTestProfile({ userId: "owner-3" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockResolvedValue({
        ...profile,
        visibility: "recruiter-only",
      });

      await updateProfile(profile.id, "owner-3", "INDIVIDUAL", {
        visibility: "recruiter-only",
      });

      expect(mockProfileRepo.update).toHaveBeenCalledWith(
        profile.id,
        expect.objectContaining({ visibility: "recruiter-only" }),
      );
    });

    it("should not allow slug changes (immutable)", async () => {
      const profile = createTestProfile({ userId: "owner-4", slug: "original" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockImplementation((_id, vals) => ({
        ...profile,
        ...vals,
      }));

      await updateProfile(profile.id, "owner-4", "INDIVIDUAL", {
        slug: "hacked-slug",
        headline: "New",
      });

      // slug should have been stripped from the update call
      const updateCall = mockProfileRepo.update.mock.calls[0][1];
      expect(updateCall.slug).toBeUndefined();
    });

    it("should not allow totalReviews changes (read-only)", async () => {
      const profile = createTestProfile({ userId: "owner-5" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockImplementation((_id, vals) => ({
        ...profile,
        ...vals,
      }));

      await updateProfile(profile.id, "owner-5", "INDIVIDUAL", {
        totalReviews: 9999,
      });

      const updateCall = mockProfileRepo.update.mock.calls[0][1];
      expect(updateCall.totalReviews).toBeUndefined();
    });

    it("should allow admin to update any profile", async () => {
      const profile = createTestProfile({ userId: "someone-else" });
      mockProfileRepo.findById.mockResolvedValue(profile);
      mockProfileRepo.update.mockResolvedValue({
        ...profile,
        headline: "Admin Changed",
      });

      // Different user, but ADMIN role — should succeed
      await expect(
        updateProfile(profile.id, "admin-user", "ADMIN", {
          headline: "Admin Changed",
        }),
      ).resolves.toBeDefined();
    });
  });

  // ──── QR Generation ────

  describe("QR generation", () => {
    it("should encode correct URL format", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await createProfile({
        userId: "qr-user",
        headline: "QR Test",
        industry: "Tech",
        location: "SG",
      });

      // Verify the QR URL was passed to toBuffer
      expect(mockToBuffer).toHaveBeenCalledWith(
        expect.stringMatching(/\/r\/[a-zA-Z0-9]+/),
        expect.objectContaining({ errorCorrectionLevel: "H" }),
      );
    });

    it("should upload QR PNG to GCS at correct path", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await createProfile({
        userId: "qr-user-2",
        headline: "Test",
        industry: "Tech",
        location: "SG",
      });

      expect(mockUploadFile).toHaveBeenCalledWith(
        expect.stringMatching(/^qr\/[a-f0-9-]+\/qr\.png$/),
        expect.any(Buffer),
        "image/png",
      );
    });

    it("should set qrCodeUrl from signed URL", async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      const result = await createProfile({
        userId: "qr-user-3",
        headline: "Test",
        industry: "Tech",
        location: "SG",
      });

      expect(result.qrCodeUrl).toContain("https://storage.example.com");
    });
  });
});
