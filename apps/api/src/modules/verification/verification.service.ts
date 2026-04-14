import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { VerificationRepository } from './verification.repo.js';
import {
  VerificationStatus,
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

    const reviewToken = await this.repo.create({
      profileId: 'placeholder-profile-id', // Replace with actual profile.id
      tokenHash,
      deviceFingerprintHash,
      ipAddressHash: null,
      gpsLatitude: data.latitude ?? null,
      gpsLongitude: data.longitude ?? null,
      gpsAccuracyMeters: data.gpsAccuracyMeters ?? null,
      scannedAt: new Date(),
      expiresAt,
      status: VerificationStatus.PENDING,
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
    const token = await this.repo.findById(data.reviewToken);
    if (!token) {
      throw new AppError('Review token not found', 404, 'TOKEN_NOT_FOUND');
    }

    if (token.status !== VerificationStatus.PENDING) {
      throw new AppError('Token already used or verified', 409, 'TOKEN_ALREADY_USED');
    }

    if (new Date(token.expiresAt) < new Date()) {
      throw new AppError('Token expired', 410, 'TOKEN_EXPIRED');
    }

    // Hash the phone number for privacy
    const phoneHash = crypto
      .createHash('sha256')
      .update(data.phone + token.profileId)
      .digest('hex');

    // Check phone cooldown — one review per phone per profile per 7 days
    const recentCount = await this.repo.countRecentByPhone(
      phoneHash,
      token.profileId,
      REVIEW_COOLDOWN_DAYS,
    );
    if (recentCount > 0) {
      throw new AppError(
        'You have already reviewed this person recently',
        429,
        'DUPLICATE_REVIEW',
      );
    }

    // Check device rate limit — max 3 phone numbers per device per 30 days
    const devicePhoneCount = await this.repo.countDistinctPhonesPerDevice(
      token.deviceFingerprintHash,
      30,
    );
    if (devicePhoneCount >= 3) {
      throw new AppError(
        'Too many verifications from this device',
        429,
        'DEVICE_PHONE_LIMIT',
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
    const token = await this.repo.findById(data.reviewToken);
    if (!token) {
      throw new AppError('Review token not found', 404, 'TOKEN_NOT_FOUND');
    }

    if (new Date(token.expiresAt) < new Date()) {
      throw new AppError('Token expired', 410, 'TOKEN_EXPIRED');
    }

    if (token.status === VerificationStatus.USED) {
      throw new AppError('Token already used', 409, 'TOKEN_ALREADY_USED');
    }

    // Verify OTP
    let verified = false;

    if (SMS_PROVIDER === 'mock') {
      // In mock mode, accept any valid 6-digit code
      verified = /^\d{6}$/.test(data.otp);
      console.log(`[MOCK SMS] Verifying OTP ${data.otp} for ${data.phone}: ${verified}`);
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

    // Hash the phone and mark token as verified
    const phoneHash = crypto
      .createHash('sha256')
      .update(data.phone + token.profileId)
      .digest('hex');

    await this.repo.update(token.id, {
      phoneHash,
      phoneVerifiedAt: new Date(),
      status: VerificationStatus.PHONE_VERIFIED,
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

    if (token.status === VerificationStatus.USED) {
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

    // Layer 1: QR Token validity (+30)
    if (reviewToken && reviewToken.status !== VerificationStatus.EXPIRED) {
      score += 30;
    }

    // Layer 1: GPS location captured (+10)
    if (reviewToken.gpsLatitude != null && reviewToken.gpsLongitude != null) {
      score += 10;
    }

    // Layer 2: Phone OTP verified (+25)
    if (reviewToken.phoneVerifiedAt != null) {
      score += 25;
    }

    // Layer 2: Phone not seen for this profile in last 7 days (+5)
    if (reviewToken.phoneHash) {
      const recentPhoneCount = await this.repo.countRecentByPhone(
        reviewToken.phoneHash,
        reviewToken.profileId,
        REVIEW_COOLDOWN_DAYS,
      );
      if (recentPhoneCount === 0) {
        score += 5;
      }
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
