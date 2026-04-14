import { EmployerRepository } from './employer.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import type {
  DashboardResponse,
  TeamMemberResponse,
  RetentionSignal,
  LeaderboardEntry,
  TeamQueryParams,
} from './employer.types.js';

export class EmployerService {
  constructor(private repo: EmployerRepository) {}

  async getDashboard(userId: string): Promise<DashboardResponse> {
    const orgId = await this.requireOrgId(userId);
    const aggregates = await this.repo.getTeamAggregates(orgId);
    const topPerformers = await this.repo.getTopPerformers(orgId, 5);
    const retentionSignals = await this.getRetentionSignals(userId);

    return {
      teamSize: Number(aggregates.teamSize),
      totalReviews: Number(aggregates.totalReviews),
      avgReviewsPerMember: Number(Number(aggregates.avgReviewsPerMember).toFixed(1)),
      avgQualityScores: {
        expertise: Number(Number(aggregates.avgExpertise).toFixed(1)),
        care: Number(Number(aggregates.avgCare).toFixed(1)),
        delivery: Number(Number(aggregates.avgDelivery).toFixed(1)),
        initiative: Number(Number(aggregates.avgInitiative).toFixed(1)),
        trust: Number(Number(aggregates.avgTrust).toFixed(1)),
      },
      topPerformers: topPerformers.map((tp: any) => this.toLeaderboardEntry(tp)),
      retentionSignals,
    };
  }

  async getTeamMembers(
    userId: string,
    query: TeamQueryParams,
  ): Promise<{ members: TeamMemberResponse[]; total: number; page: number; limit: number }> {
    const orgId = await this.requireOrgId(userId);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const offset = (page - 1) * limit;

    const [members, total] = await Promise.all([
      this.repo.getTeamProfiles(orgId, {
        limit,
        offset,
        sortBy: query.sortBy ?? 'compositeScore',
        order: query.order ?? 'desc',
      }),
      this.repo.getTeamMemberCount(orgId),
    ]);

    return {
      members: members.map((m: any) => this.toTeamMember(m)),
      total,
      page,
      limit,
    };
  }

  async getTeamMember(userId: string, profileId: string): Promise<TeamMemberResponse> {
    const orgId = await this.requireOrgId(userId);
    const member = await this.repo.getTeamMemberProfile(orgId, profileId);
    if (!member) {
      throw new AppError('Team member not found or not visible', 404, 'MEMBER_NOT_FOUND');
    }
    return this.toTeamMember(member);
  }

  async getTopPerformers(userId: string, limit: number = 10): Promise<LeaderboardEntry[]> {
    const orgId = await this.requireOrgId(userId);
    const performers = await this.repo.getTopPerformers(orgId, limit);
    return performers.map((p: any) => this.toLeaderboardEntry(p));
  }

  async getRetentionSignals(userId: string): Promise<RetentionSignal[]> {
    const orgId = await this.requireOrgId(userId);
    const candidates = await this.repo.getRetentionCandidates(orgId);
    const signals: RetentionSignal[] = [];

    for (const candidate of candidates) {
      const velocity = await this.repo.getWeeklyVelocity(candidate.profileId, 8);
      if (velocity.length < 4) continue;

      const weeklyData = velocity.map((v: any) => ({
        week: new Date(v.week).toISOString(),
        count: Number(v.count),
      }));

      const recent2 = weeklyData.slice(-2);
      const previous2 = weeklyData.slice(-4, -2);

      const recentAvg = recent2.reduce((sum, w) => sum + w.count, 0) / 2;
      const previousAvg = previous2.reduce((sum, w) => sum + w.count, 0) / 2;

      if (previousAvg === 0) continue;

      const dropPercent = ((previousAvg - recentAvg) / previousAvg) * 100;

      if (dropPercent > 50) {
        signals.push({
          profileId: candidate.profileId,
          displayName: candidate.displayName,
          roleTitle: candidate.roleTitle,
          previousAvgReviews: Number(previousAvg.toFixed(1)),
          recentAvgReviews: Number(recentAvg.toFixed(1)),
          dropPercent: Number(dropPercent.toFixed(1)),
          weeklyVelocity: weeklyData,
        });
      }
    }

    return signals;
  }

  private async requireOrgId(userId: string): Promise<string> {
    const orgId = await this.repo.getEmployerOrgId(userId);
    if (!orgId) {
      throw new AppError('Employer organization not found', 404, 'ORG_NOT_FOUND');
    }
    return orgId;
  }

  private toTeamMember(m: any): TeamMemberResponse {
    return {
      profileId: m.profileId,
      displayName: m.displayName,
      avatarUrl: m.avatarUrl ?? null,
      roleTitle: m.roleTitle ?? null,
      totalReviews: Number(m.totalReviews),
      qualityBreakdown: {
        expertise: Number(m.expertiseCount),
        care: Number(m.careCount),
        delivery: Number(m.deliveryCount),
        initiative: Number(m.initiativeCount),
        trust: Number(m.trustCount),
      },
      verifiedRate: Number(m.verifiedRate),
      compositeScore: Number(m.compositeScore ?? 0),
      leaderboardOptOut: Boolean(m.leaderboardOptOut),
    };
  }

  private toLeaderboardEntry(p: any): LeaderboardEntry {
    return {
      profileId: p.profileId,
      displayName: p.displayName,
      roleTitle: p.roleTitle ?? null,
      totalReviews: Number(p.totalReviews),
      compositeScore: Number(p.compositeScore),
      rank: p.rank != null ? Number(p.rank) : null,
      leaderboardOptOut: Boolean(p.leaderboardOptOut),
    };
  }
}
