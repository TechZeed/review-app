import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../config/sequelize.js';

export class EmployerRepository {
  async getEmployerOrgId(userId: string): Promise<string | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ organization_id: string }>(
      `SELECT ed.organization_id
       FROM employer_dashboards ed
       WHERE ed.user_id = :userId
       LIMIT 1`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
    return result?.organization_id ?? null;
  }

  async getTeamAggregates(orgId: string): Promise<any> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `SELECT
        COUNT(DISTINCT p.id) AS "teamSize",
        COALESCE(SUM(p.total_reviews), 0) AS "totalReviews",
        COALESCE(AVG(p.total_reviews), 0) AS "avgReviewsPerMember",
        COALESCE(AVG(p.expertise_count), 0) AS "avgExpertise",
        COALESCE(AVG(p.care_count), 0) AS "avgCare",
        COALESCE(AVG(p.delivery_count), 0) AS "avgDelivery",
        COALESCE(AVG(p.initiative_count), 0) AS "avgInitiative",
        COALESCE(AVG(p.trust_count), 0) AS "avgTrust"
      FROM profiles p
      JOIN profile_organizations po ON po.profile_id = p.id
      WHERE po.organization_id = :orgId
        AND po.is_current = true
        AND po.employer_visible = true`,
      {
        replacements: { orgId },
        type: QueryTypes.SELECT,
      },
    );
    return result;
  }

  async getTeamProfiles(
    orgId: string,
    options: { limit: number; offset: number; sortBy: string; order: string },
  ): Promise<any[]> {
    const sequelize = getSequelize();
    const sortColumn = this.resolveSortColumn(options.sortBy);
    const sortOrder = options.order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    return sequelize.query<any>(
      `SELECT
        p.id AS "profileId",
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl",
        po.role_title AS "roleTitle",
        p.total_reviews AS "totalReviews",
        p.expertise_count AS "expertiseCount",
        p.care_count AS "careCount",
        p.delivery_count AS "deliveryCount",
        p.initiative_count AS "initiativeCount",
        p.trust_count AS "trustCount",
        po.leaderboard_opt_out AS "leaderboardOptOut",
        COALESCE(verified_stats.verified_rate, 0) AS "verifiedRate",
        (
          CASE WHEN MAX(p.total_reviews) OVER () > 0
            THEN LEAST(p.total_reviews::float / MAX(p.total_reviews) OVER (), 1.0) * 0.40
            ELSE 0
          END
          + CASE WHEN p.total_reviews > 0
              THEN GREATEST(p.expertise_count, p.care_count, p.delivery_count,
                            p.initiative_count, p.trust_count)::float
                   / p.total_reviews * 0.30
              ELSE 0
            END
          + CASE WHEN p.total_reviews > 0
              THEN COALESCE(verified_stats.verified_rate, 0) * 0.30
              ELSE 0
            END
        ) AS "compositeScore"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      JOIN profile_organizations po ON po.profile_id = p.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE r.is_verified_interaction = TRUE)::FLOAT
            / NULLIF(COUNT(*), 0) AS verified_rate
        FROM reviews r
        WHERE r.profile_id = p.id
      ) verified_stats ON TRUE
      WHERE po.organization_id = :orgId
        AND po.is_current = true
        AND po.employer_visible = true
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT :limit OFFSET :offset`,
      {
        replacements: { orgId, limit: options.limit, offset: options.offset },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getTeamMemberCount(orgId: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(DISTINCT p.id) AS count
       FROM profiles p
       JOIN profile_organizations po ON po.profile_id = p.id
       WHERE po.organization_id = :orgId
         AND po.is_current = true
         AND po.employer_visible = true`,
      {
        replacements: { orgId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async getTeamMemberProfile(orgId: string, profileId: string): Promise<any | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `SELECT
        p.id AS "profileId",
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl",
        po.role_title AS "roleTitle",
        p.total_reviews AS "totalReviews",
        p.expertise_count AS "expertiseCount",
        p.care_count AS "careCount",
        p.delivery_count AS "deliveryCount",
        p.initiative_count AS "initiativeCount",
        p.trust_count AS "trustCount",
        po.leaderboard_opt_out AS "leaderboardOptOut",
        COALESCE(verified_stats.verified_rate, 0) AS "verifiedRate"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      JOIN profile_organizations po ON po.profile_id = p.id
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE r.is_verified_interaction = TRUE)::FLOAT
            / NULLIF(COUNT(*), 0) AS verified_rate
        FROM reviews r
        WHERE r.profile_id = p.id
      ) verified_stats ON TRUE
      WHERE po.organization_id = :orgId
        AND po.is_current = true
        AND po.employer_visible = true
        AND p.id = :profileId`,
      {
        replacements: { orgId, profileId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async getTopPerformers(orgId: string, limit: number = 10): Promise<any[]> {
    const sequelize = getSequelize();
    return sequelize.query<any>(
      `WITH team_max AS (
        SELECT MAX(p.total_reviews) AS max_reviews
        FROM profiles p
        JOIN profile_organizations po ON po.profile_id = p.id
        WHERE po.organization_id = :orgId
          AND po.is_current = true
          AND po.employer_visible = true
      ),
      team_scores AS (
        SELECT
          p.id AS "profileId",
          u.display_name AS "displayName",
          po.role_title AS "roleTitle",
          p.total_reviews AS "totalReviews",
          po.leaderboard_opt_out AS "leaderboardOptOut",
          CASE WHEN tm.max_reviews > 0
            THEN LEAST(p.total_reviews::float / tm.max_reviews, 1.0) * 0.40
            ELSE 0
          END AS reviews_component,
          CASE WHEN p.total_reviews > 0
            THEN GREATEST(p.expertise_count, p.care_count, p.delivery_count,
                          p.initiative_count, p.trust_count)::float
                 / p.total_reviews * 0.30
            ELSE 0
          END AS quality_component,
          CASE WHEN p.total_reviews > 0
            THEN (SELECT COUNT(*)::float FROM verifiable_references vr
                  JOIN reviews r ON r.id = vr.review_id
                  WHERE r.profile_id = p.id AND vr.is_contactable = true)
                 / p.total_reviews * 0.30
            ELSE 0
          END AS verified_component
        FROM profiles p
        INNER JOIN users u ON u.id = p.user_id
        JOIN profile_organizations po ON po.profile_id = p.id
        CROSS JOIN team_max tm
        WHERE po.organization_id = :orgId
          AND po.is_current = true
          AND po.employer_visible = true
      )
      SELECT
        "profileId",
        "displayName",
        "roleTitle",
        "totalReviews",
        "leaderboardOptOut",
        (reviews_component + quality_component + verified_component) AS "compositeScore",
        CASE WHEN "leaderboardOptOut" THEN NULL
             ELSE RANK() OVER (
               PARTITION BY (NOT "leaderboardOptOut")
               ORDER BY (reviews_component + quality_component + verified_component) DESC
             )
        END AS rank
      FROM team_scores
      ORDER BY "compositeScore" DESC
      LIMIT :limit`,
      {
        replacements: { orgId, limit },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getWeeklyVelocity(profileId: string, weeks: number = 8): Promise<any[]> {
    const sequelize = getSequelize();
    return sequelize.query<any>(
      `SELECT
        date_trunc('week', r.created_at)::date AS week,
        COUNT(*) AS count
      FROM reviews r
      WHERE r.profile_id = :profileId
        AND r.created_at >= NOW() - INTERVAL '${weeks} weeks'
      GROUP BY date_trunc('week', r.created_at)
      ORDER BY week`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getRetentionCandidates(orgId: string): Promise<any[]> {
    const sequelize = getSequelize();
    return sequelize.query<any>(
      `SELECT
        p.id AS "profileId",
        u.display_name AS "displayName",
        po.role_title AS "roleTitle",
        p.total_reviews AS "totalReviews"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      JOIN profile_organizations po ON po.profile_id = p.id
      WHERE po.organization_id = :orgId
        AND po.is_current = true
        AND po.employer_visible = true
        AND p.total_reviews > 0`,
      {
        replacements: { orgId },
        type: QueryTypes.SELECT,
      },
    );
  }

  private resolveSortColumn(sortBy: string): string {
    switch (sortBy) {
      case 'totalReviews':
        return 'p.total_reviews';
      case 'displayName':
        return 'u.display_name';
      case 'compositeScore':
      default:
        return '"compositeScore"';
    }
  }
}
