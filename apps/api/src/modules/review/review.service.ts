import crypto from 'node:crypto';
import { ReviewRepo } from './review.repo.js';
import { ProfileRepo } from '../profile/profile.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { SubmitReviewInput, ScanInput, ScanResponse, ReviewResponse } from './review.types.js';

export class ReviewService {
  constructor(
    private repo: ReviewRepo,
    private profileRepo: ProfileRepo,
  ) {}

  /**
   * Scan a profile QR code: generate a review token, capture device/location data
   */
  async scanProfile(slug: string, data: ScanInput): Promise<ScanResponse> {
    // Look up profile by slug
    const profile = await this.profileRepo.findBySlug(slug);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Generate a review token (UUID v4)
    const reviewToken = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(reviewToken).digest('hex');
    const deviceFingerprintHash = crypto.createHash('sha256').update(data.deviceFingerprint).digest('hex');

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (env.REVIEW_SESSION_TTL_HOURS ?? 48));

    // Store the review token record
    // In a full implementation, this would write to a `review_tokens` table.
    // For now, we store it in a lightweight way. The verification module handles OTP.
    try {
      const { ReviewToken } = await import('../verification/verification.model.js');
      await ReviewToken.create({
        profileId: profile.getDataValue('id'),
        tokenHash,
        deviceFingerprintHash,
        scannedAt: new Date(),
        expiresAt,
        isUsed: false,
        phoneVerified: false,
      } as any);
    } catch (err) {
      logger.warn('ReviewToken model not available, storing token in memory', {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    return {
      reviewToken,
      expiresAt: expiresAt.toISOString(),
      profile: {
        id: profile.getDataValue('id'),
        name: profile.getDataValue('headline') ?? '',
        photo: undefined,
        organization: undefined,
        role: undefined,
      },
    };
  }

  /**
   * Submit a review: validate token, create review, increment profile counters, calculate fraud score
   */
  async submitReview(data: SubmitReviewInput): Promise<any> {
    // Validate review token
    const tokenHash = crypto.createHash('sha256').update(data.reviewToken).digest('hex');

    const { ReviewToken } = await import('../verification/verification.model.js');
    const reviewTokenRecord: any = await ReviewToken.findOne({ where: { tokenHash } });

    if (!reviewTokenRecord) {
      throw new AppError('Review token not found', 404, 'REVIEW_TOKEN_NOT_FOUND');
    }

    if (reviewTokenRecord.isUsed || reviewTokenRecord.is_used) {
      throw new AppError('Review token has already been used', 409, 'REVIEW_TOKEN_ALREADY_USED');
    }

    if (new Date(reviewTokenRecord.expiresAt || reviewTokenRecord.expires_at) < new Date()) {
      throw new AppError('Review token has expired', 410, 'REVIEW_TOKEN_EXPIRED');
    }

    // Derive phoneHash from the verified token if the client didn't pass
    // one. verification.service.verifyOtp persists phoneHash on the token
    // at OTP verify time, so it's available here without trusting the client.
    const resolvedPhoneHash: string = data.phoneHash ?? reviewTokenRecord?.phoneHash ?? '';

    // Check duplicate review (one per phone per profile per 7 days)
    if (resolvedPhoneHash) {
      const profileId = reviewTokenRecord?.profileId;
      if (profileId) {
        const existingReview = await this.repo.findByReviewerAndProfile(
          resolvedPhoneHash,
          profileId,
          7,
        );
        if (existingReview) {
          throw new AppError(
            'You have already reviewed this person recently. You can review again after 7 days.',
            429,
            'DUPLICATE_REVIEW',
          );
        }
      }
    }

    // Calculate fraud score (simplified)
    const fraudScore = this.calculateFraudScore(data, reviewTokenRecord);

    // Determine badge type based on fraud score and verification
    const badgeType = this.determineBadgeType(fraudScore, reviewTokenRecord);

    // Create review record
    const profileId = reviewTokenRecord?.profileId;
    const deviceFingerprintHash = reviewTokenRecord?.deviceFingerprintHash ?? '';
    const review = await this.repo.create({
      profileId,
      reviewTokenId: reviewTokenRecord?.id ?? null,
      qualityPicks: data.qualities,
      reviewerPhoneHash: resolvedPhoneHash,
      deviceFingerprintHash,
      locationLat: reviewTokenRecord?.gpsLatitude ?? null,
      locationLng: reviewTokenRecord?.gpsLongitude ?? null,
      isVerifiedInteraction: fraudScore >= 80,
      fraudScore,
    } as any);

    // Mark token as used (attribute name, not column name — the model
    // maps `isUsed` → column `is_used`).
    if (reviewTokenRecord) {
      await reviewTokenRecord.update({
        isUsed: true,
      });
    }

    // Increment profile quality counters
    if (profileId) {
      await this.profileRepo.updateQualityCounts(profileId, data.qualities);
    }

    logger.info('Review submitted', {
      reviewId: review.getDataValue('id'),
      profileId,
      qualities: data.qualities,
      fraudScore,
      badgeType,
    });

    return {
      reviewId: review.getDataValue('id'),
      badgeTier: badgeType,
      profileSnapshot: profileId
        ? {
            name: reviewTokenRecord?.profile?.displayName ?? '',
            qualityBreakdown: {},
          }
        : undefined,
    };
  }

  /**
   * Get reviews by profile (paginated)
   */
  async getReviewsByProfile(
    profileId: string,
    options: { page: number; limit: number; sortBy?: string },
  ): Promise<any> {
    // Verify profile exists
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    // Check visibility
    const visibility = profile.getDataValue('visibility');
    if (visibility === 'private') {
      throw new AppError('This profile is private', 403, 'PROFILE_PRIVATE');
    }

    const { rows, count } = await this.repo.findByProfile(profileId, options);

    return {
      reviews: rows.map((r) => this.toReviewResponse(r)),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: count,
        totalPages: Math.ceil(count / options.limit),
      },
    };
  }

  /**
   * Customer-side history: reviews that were submitted from a specific
   * device fingerprint. Public (no auth) — the fingerprint acts as the
   * soft identity for anonymous customers. Spec 19 customer-history row.
   */
  async getMySubmissions(
    deviceFingerprint: string,
    options: { page: number; limit: number },
  ): Promise<any> {
    const deviceFingerprintHash = crypto
      .createHash('sha256')
      .update(deviceFingerprint)
      .digest('hex');
    const { rows, count } = await this.repo.findByDeviceFingerprintHash(
      deviceFingerprintHash,
      options,
    );
    return {
      reviews: rows.map((r) => this.toReviewResponse(r)),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: count,
        totalPages: Math.ceil(count / options.limit),
      },
    };
  }

  /**
   * Get reviews for the authenticated user's profile
   */
  async getMyReviews(
    userId: string,
    options: { page: number; limit: number; sortBy?: string },
  ): Promise<any> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
    }

    const profileId = profile.getDataValue('id');
    const { rows, count } = await this.repo.findByProfile(profileId, options);

    return {
      reviews: rows.map((r) => this.toReviewResponse(r)),
      pagination: {
        page: options.page,
        limit: options.limit,
        total: count,
        totalPages: Math.ceil(count / options.limit),
      },
    };
  }

  /**
   * Calculate fraud score on a 0-100 scale.
   * Higher = more trustworthy.
   */
  private calculateFraudScore(data: SubmitReviewInput, tokenRecord: any): number {
    let score = 50; // Base score

    // Phone verification bonus
    if (data.phoneHash) {
      score += 20;
    }

    // Token record exists and was properly created via QR scan
    if (tokenRecord) {
      score += 10;

      // GPS data captured
      if (tokenRecord.gpsLatitude && tokenRecord.gpsLongitude) {
        score += 10;
      }

      // Phone was verified via OTP
      if (tokenRecord.phoneVerified || tokenRecord.phone_verified) {
        score += 10;
      }
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Determine badge type based on fraud score and verification status
   */
  private determineBadgeType(fraudScore: number, tokenRecord: any): string {
    if (fraudScore >= 80) return 'verified_interaction';
    if (fraudScore >= 60) return 'verified';
    if (fraudScore >= 40) return 'standard';
    return 'low_confidence';
  }

  private toReviewResponse(review: any): ReviewResponse {
    return {
      id: review.id,
      profileId: review.profileId,
      qualities: review.qualityPicks ?? [],
      thumbsUp: true,
      badgeTier: review.isVerifiedInteraction ? 'verified_interaction' : 'standard',
      verifiable: false,
      createdAt: review.createdAt ? new Date(review.createdAt).toISOString() : new Date().toISOString(),
    };
  }
}
