export enum ReviewStatus {
  ACTIVE = 'active',
  FLAGGED = 'flagged',
  REMOVED = 'removed',
}

export interface SubmitReviewInput {
  reviewToken: string;
  qualities: Array<'expertise' | 'care' | 'delivery' | 'initiative' | 'trust'>;
  qualityDisplayOrder: Array<'expertise' | 'care' | 'delivery' | 'initiative' | 'trust'>;
  thumbsUp: true;
  phoneHash?: string;
  optInVerifiable?: boolean;
}

export interface ReviewResponse {
  id: string;
  profileId: string;
  qualities: string[];
  thumbsUp: boolean;
  badgeTier: string;
  mediaType?: string;
  textContent?: string;
  voiceDuration?: number;
  videoDuration?: number;
  verifiable: boolean;
  createdAt: string;
}

export interface ScanInput {
  deviceFingerprint: string;
  latitude?: number;
  longitude?: number;
  userAgent?: string;
}

export interface ScanResponse {
  reviewToken: string;
  expiresAt: string;
  profile: {
    id: string;
    name: string;
    photo?: string;
    organization?: string;
    role?: string;
  };
}
