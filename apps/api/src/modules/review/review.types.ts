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
    // spec 25 / spec 19 B2: `name` is the person's display name.
    name: string;
    // `headline` is the role title (was previously returned under `name`).
    headline: string | null;
    // Reviewee photo sourced from users.avatar_url. null when unset.
    photoUrl: string | null;
    organization?: string;
    role?: string;
  };
}
