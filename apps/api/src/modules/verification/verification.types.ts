export enum VerificationStatus {
  PENDING = 'pending',
  PHONE_VERIFIED = 'phone_verified',
  USED = 'used',
  EXPIRED = 'expired',
}

export interface InitiateInput {
  slug: string;
  deviceFingerprint: string;
  latitude?: number;
  longitude?: number;
  gpsAccuracyMeters?: number;
  userAgent?: string;
}

export interface SendOtpInput {
  reviewToken: string;
  phone: string;
  channel?: 'sms' | 'whatsapp';
}

export interface VerifyOtpInput {
  reviewToken: string;
  phone: string;
  otp: string;
}

export interface ReviewTokenResponse {
  reviewTokenId: string;
  expiresAt: string;
  profile: {
    id: string;
    name: string;
    photoUrl?: string;
    currentOrg?: string;
    currentRole?: string;
  };
  qualities: string[];
}

export interface OtpSentResponse {
  otpSent: boolean;
  phoneLastFour: string;
  expiresInSeconds: number;
  channel: string;
}

export interface OtpVerifiedResponse {
  verified: boolean;
  phoneHash: string;
  reviewTokenId: string;
}

export interface TokenValidationResponse {
  valid: boolean;
  reason?: 'expired' | 'used' | 'invalid';
  expiresAt?: string;
  profileId?: string;
  profileName?: string;
}

export interface FraudScoreResult {
  score: number;
  badgeType: 'verified_interaction' | 'standard' | 'low_confidence' | 'held';
  isHeld: boolean;
  flags: FraudFlag[];
}

export interface FraudFlag {
  flagType: string;
  severity: 'low' | 'medium' | 'high';
  details: Record<string, any>;
}
