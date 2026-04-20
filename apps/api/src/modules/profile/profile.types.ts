export enum ProfileVisibility {
  PRIVATE = 'private',
  EMPLOYER = 'employer',
  RECRUITER = 'recruiter',
  PUBLIC = 'public',
}

export interface CreateProfileInput {
  name: string;
  photo?: string;
  industry?: string;
  role?: string;
  bio?: string;
  visibility?: ProfileVisibility;
}

export interface UpdateProfileInput {
  name?: string;
  headline?: string;
  photo?: string;
  industry?: string;
  role?: string;
  bio?: string;
}

export interface ProfileWithScores {
  id: string;
  slug: string;
  name: string;
  photo?: string;
  industry?: string;
  role?: string;
  bio?: string;
  visibility: ProfileVisibility;
  qrCodeUrl?: string;
  profileUrl: string;
  reviewCount: number;
  qualityBreakdown: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  signatureStrengths: string[];
  trustTier: string;
  createdAt: string;
  updatedAt: string;
}
