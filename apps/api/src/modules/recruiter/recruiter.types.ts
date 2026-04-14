export enum ContactStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
  EXPIRED = 'expired',
}

export interface SearchFilters {
  query?: string;
  industries?: string[];
  location?: string;
  qualities?: Array<{
    quality: 'expertise' | 'care' | 'delivery' | 'initiative' | 'trust';
    minPercentage: number;
  }>;
  minReviewCount?: number;
  activeInLastMonths?: number;
  minVerifiedRate?: number;
  hasVideo?: boolean;
  cursor?: string;
  limit?: number;
}

export interface SearchResult {
  profileId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  industry: string | null;
  location: string | null;
  headline: string | null;
  totalReviews: number;
  qualityBreakdown: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  hasVideo: boolean;
  verifiedRate: number;
  recentCount: number;
  compositeScore: number;
  isPro: boolean;
}

export interface PaginatedSearchResult {
  results: SearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ContactRequestInput {
  subject: string;
  message: string;
  hiringRole: string;
  companyName: string;
}

export interface ContactRequestResponse {
  id: string;
  recruiterUserId: string;
  profileId: string;
  subject: string;
  message: string;
  hiringRole: string;
  companyName: string;
  status: ContactStatus;
  respondedAt: string | null;
  createdAt: string;
}

export interface ProfileViewResponse {
  profileId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  industry: string | null;
  location: string | null;
  headline: string | null;
  totalReviews: number;
  qualityBreakdown: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  hasVideo: boolean;
  verifiedRate: number;
  verifiableReferenceCount: number;
  isPro: boolean;
}

export interface SearchHistoryEntry {
  id: string;
  searchFilters: SearchFilters;
  resultsCount: number;
  lastRunAt: string;
  createdAt: string;
}
