export interface DashboardResponse {
  teamSize: number;
  totalReviews: number;
  avgReviewsPerMember: number;
  avgQualityScores: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  topPerformers: LeaderboardEntry[];
  retentionSignals: RetentionSignal[];
}

export interface TeamMemberResponse {
  profileId: string;
  displayName: string;
  avatarUrl: string | null;
  roleTitle: string | null;
  totalReviews: number;
  qualityBreakdown: {
    expertise: number;
    care: number;
    delivery: number;
    initiative: number;
    trust: number;
  };
  verifiedRate: number;
  compositeScore: number;
  leaderboardOptOut: boolean;
}

export interface RetentionSignal {
  profileId: string;
  displayName: string;
  roleTitle: string | null;
  previousAvgReviews: number;
  recentAvgReviews: number;
  dropPercent: number;
  weeklyVelocity: Array<{ week: string; count: number }>;
}

export interface LeaderboardEntry {
  profileId: string;
  displayName: string;
  roleTitle: string | null;
  totalReviews: number;
  compositeScore: number;
  rank: number | null;
  leaderboardOptOut: boolean;
}

export interface DashboardQueryParams {
  period?: number;
  groupBy?: 'location';
}

export interface TeamQueryParams {
  page?: number;
  limit?: number;
  sortBy?: 'compositeScore' | 'totalReviews' | 'displayName';
  order?: 'asc' | 'desc';
}
