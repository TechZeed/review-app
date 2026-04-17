import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { VerificationRepository } from './verification.repo.js';
import {
  InitiateInput,
  SendOtpInput,
  VerifyOtpInput,
  ReviewTokenResponse,
  OtpSentResponse,
  OtpVerifiedResponse,
  TokenValidationResponse,
  FraudScoreResult,
  FraudFlag,
} from './verification.types.js';
import { AppError } from '../../shared/errors/appError.js';

const TOKEN_EXPIRY_HOURS = parseInt(process.env.REVIEW_TOKEN_EXPIRY_HOURS || '48', 10);
const REVIEW_COOLDOWN_DAYS = parseInt(process.env.REVIEW_COOLDOWN_DAYS || '7', 10);
const SMS_PROVIDER = process.env.SMS_PROVIDER || 'mock';

export class VerificationService {
  constructor(private repo: VerificationRepository) {}

  async initiateReview(data: InitiateInput): Promise<ReviewTokenResponse> {
    // In production, look up the profile by slug:
    // const profile = await profileRepo.findBySlug(data.slug);
    // if (!profile) throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');

    const tokenUuid = uuidv4();
    const tokenHash = crypto.createHash('sha256').update(tokenUuid).digest('hex');
    const deviceFingerprintHash = crypto
      .createHash('sha256')
      .update(data.deviceFingerprint)
      .digest('hex');

    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // NOTE: this endpoint is orphaned — the live scan flow uses
    // POST /reviews/scan/:slug (review.service.scanProfile). Kept here
    // pending a decision to remove or rebuild it against real profile lookup.
    const reviewToken = await this.repo.create({
      profileId: 'placeholder-profile-id', // Replace with actual profile.id
      tokenHash,
      deviceFingerprintHash,
      scannedAt: new Date(),
      expiresAt,
    });

    return {
      reviewTokenId: reviewToken.id,
      expiresAt: expiresAt.toISOString(),
      profile: {
        id: 'placeholder-profile-id',
        name: 'Placeholder Name',
      },
      qualities: ['expertise', 'care', 'delivery', 'initiative', 'trust'],
    };
  }

  async sendOtp(data: SendOtpInput): Promise<OtpSentResponse> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(data.reviewToken)
      .digest('hex');
    const token = await this.repo.findByTokenHash(tokenHash);
    if (!token) {
      throw new AppError('Review token not found', 404, 'TOKEN_NOT_FOUND');
    }

    if (token.isUsed) {
      throw new AppError('Token already used', 409, 'TOKEN_ALREADY_USED');
    }

    if (new Date(token.expiresAt) < new Date()) {
      throw new AppError('Token expired', 410, 'TOKEN_EXPIRED');
    }

    // Phone cooldown — same phone + profile within REVIEW_COOLDOWN_DAYS.
    // Source of truth is the `reviews` table (reviewer_phone_hash), not
    // review_tokens. Dynamic import so verification has no hard dep on
    // the review module at load time.
    const phoneHash = crypto
      .createHash('sha256')
      .update(data.phone + token.profileId)
      .digest('hex');
    const { Review } = await import('../review/review.model.js');
    const { Op } = await import('sequelize');
    const cooldownSince = new Date(Date.now() - REVIEW_COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
    const existingReview = await Review.findOne({
      where: {
        profileId: token.profileId,
        reviewerPhoneHash: phoneHash,
        createdAt: { [Op.gte]: cooldownSince },
      },
    });
    if (existingReview) {
      throw new AppError(
        'You have already reviewed this person recently',
        429,
        'DUPLICATE_REVIEW',
      );
    }

    // Send OTP
    if (SMS_PROVIDER === 'mock') {
      const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
      console.log(`[MOCK SMS] OTP for ${data.phone}: ${mockOtp}`);
    } else {
      // Production: Use Twilio Verify API
      // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // await twilio.verify.v2
      //   .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      //   .verifications.create({ to: data.phone, channel: data.channel || 'sms' });
    }

    const phoneLastFour = data.phone.slice(-4);

    return {
      otpSent: true,
      phoneLastFour,
      expiresInSeconds: 300,
      channel: data.channel || 'sms',
    };
  }

  async verifyOtp(data: VerifyOtpInput): Promise<OtpVerifiedResponse> {
    const tokenHash = crypto
      .createHash('sha256')
      .update(data.reviewToken)
      .digest('hex');
    const token = await this.repo.findByTokenHash(tokenHash);
    if (!token) {
      throw new AppError('Review token not found', 404, 'TOKEN_NOT_FOUND');
    }

    if (new Date(token.expiresAt) < new Date()) {
      throw new AppError('Token expired', 410, 'TOKEN_EXPIRED');
    }

    if (token.isUsed) {
      throw new AppError('Token already used', 409, 'TOKEN_ALREADY_USED');
    }

    // Verify OTP
    let verified = false;

    if (SMS_PROVIDER === 'mock') {
      // Mock mode: accept any 6-digit code whose digits sum to 7
      // (e.g. 000007, 000016, 700000, 001123). Stable, dev-friendly,
      // no leakage of a single hardcoded code.
      const is6Digit = /^\d{6}$/.test(data.otp);
      const digitSum = is6Digit
        ? data.otp.split('').reduce((s, c) => s + Number(c), 0)
        : -1;
      verified = is6Digit && digitSum === 7;
      console.log(
        `[MOCK SMS] Verifying OTP ${data.otp} for ${data.phone}: sum=${digitSum} verified=${verified}`,
      );
    } else {
      // Production: Use Twilio Verify Check API
      // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      // const check = await twilio.verify.v2
      //   .services(process.env.TWILIO_VERIFY_SERVICE_SID)
      //   .verificationChecks.create({ to: data.phone, code: data.otp });
      // verified = check.status === 'approved';
    }

    if (!verified) {
      throw new AppError('Invalid OTP code', 401, 'INVALID_OTP');
    }

    // Hash the phone (response echo only — not persisted; schema uses
    // reviewer_phone_hash on the reviews table at submit time).
    const phoneHash = crypto
      .createHash('sha256')
      .update(data.phone + token.profileId)
      .digest('hex');

    await this.repo.update(token.id, {
      phoneVerified: true,
      phoneHash,
    });

    return {
      verified: true,
      phoneHash,
      reviewTokenId: token.id,
    };
  }

  async validateToken(tokenId: string): Promise<TokenValidationResponse> {
    const token = await this.repo.findById(tokenId);

    if (!token) {
      return { valid: false, reason: 'invalid' };
    }

    if (token.isUsed) {
      return { valid: false, reason: 'used' };
    }

    if (new Date(token.expiresAt) < new Date()) {
      return { valid: false, reason: 'expired' };
    }

    return {
      valid: true,
      expiresAt: new Date(token.expiresAt).toISOString(),
      profileId: token.profileId,
      profileName: undefined, // Populated in production from profile lookup
    };
  }

  async calculateFraudScore(reviewToken: any, qualityPicks: string[]): Promise<FraudScoreResult> {
    let score = 0;
    const flags: FraudFlag[] = [];

    // Layer 1: QR Token validity (+30) — token not expired and not used
    if (
      reviewToken &&
      new Date(reviewToken.expiresAt) > new Date() &&
      !reviewToken.isUsed
    ) {
      score += 30;
    }

    // Layer 2: Phone OTP verified (+25)
    if (reviewToken.phoneVerified) {
      score += 25;
    }

    // Layer 3: Token used within 1 hour of scan (+10)
    const scannedAt = new Date(reviewToken.scannedAt);
    const now = new Date();
    const hoursSinceScan = (now.getTime() - scannedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceScan <= 1) {
      score += 10;
    }

    // Layer 4: Device velocity check — 3+ distinct profiles in 1 hour
    const deviceVelocity = await this.repo.countDistinctDeviceReviews(
      reviewToken.deviceFingerprintHash,
      1,
    );
    if (deviceVelocity >= 3) {
      flags.push({
        flagType: 'device_velocity',
        severity: 'high',
        details: { distinctProfiles: deviceVelocity, windowHours: 1 },
      });
    } else {
      score += 10; // No device velocity flag (+10)
    }

    // Layer 4: No pattern anomalies (+5)
    if (flags.length === 0) {
      score += 5;
    }

    // Layer 5: Media bonus (+5) — added at media upload time, not here

    score = Math.min(score, 100);

    // Determine badge type
    let badgeType: FraudScoreResult['badgeType'];
    if (score >= 80) {
      badgeType = 'verified_interaction';
    } else if (score >= 50) {
      badgeType = 'standard';
    } else if (score >= 30) {
      badgeType = 'low_confidence';
    } else {
      badgeType = 'held';
    }

    const isHeld = score < 30 || flags.some((f) => f.severity === 'high');

    return { score, badgeType, isHeld, flags };
  }

  async checkPatterns(
    deviceHash: string,
    phoneHash: string,
  ): Promise<FraudFlag[]> {
    const flags: FraudFlag[] = [];

    // Device velocity: 3+ distinct profiles in 1 hour
    const deviceVelocity = await this.repo.countDistinctDeviceReviews(deviceHash, 1);
    if (deviceVelocity >= 3) {
      flags.push({
        flagType: 'device_velocity',
        severity: 'high',
        details: { distinctProfiles: deviceVelocity, windowHours: 1 },
      });
    }

    // Phone velocity: 5+ uses in 24 hours
    if (phoneHash) {
      const phoneVelocity = await this.repo.countRecentByDevice(phoneHash, 24);
      if (phoneVelocity >= 5) {
        flags.push({
          flagType: 'phone_velocity',
          severity: 'high',
          details: { count: phoneVelocity, windowHours: 24 },
        });
      }
    }

    return flags;
  }
}
