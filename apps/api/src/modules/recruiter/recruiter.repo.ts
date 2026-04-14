import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../config/sequelize.js';
import type { SearchFilters, SearchResult, PaginatedSearchResult } from './recruiter.types.js';

const QUALITY_COLUMN_MAP: Record<string, string> = {
  expertise: 'expertise_count',
  care: 'care_count',
  delivery: 'delivery_count',
  initiative: 'initiative_count',
  trust: 'trust_count',
};

export class RecruiterRepository {
  async search(
    filters: SearchFilters,
    recruiterUserId: string,
  ): Promise<PaginatedSearchResult> {
    const sequelize = getSequelize();
    const limit = filters.limit ?? 20;
    const whereClauses: string[] = [];
    const replacements: Record<string, unknown> = {};

    // Visibility gate (always applied)
    whereClauses.push(`p.visibility IN ('recruiter_visible', 'public')`);

    // Blocked recruiters exclusion
    whereClauses.push(`
      NOT EXISTS (
        SELECT 1 FROM recruiter_blocks rb
        WHERE rb.profile_id = p.id AND rb.recruiter_user_id = :recruiterUserId
      )
    `);
    replacements.recruiterUserId = recruiterUserId;

    // Full-text query
    if (filters.query) {
      whereClauses.push(`(
        p.search_vector @@ plainto_tsquery('english', :query)
        OR u.display_name ILIKE :queryLike
      )`);
      replacements.query = filters.query;
      replacements.queryLike = `%${filters.query}%`;
    }

    // Industry filter (multi-select)
    if (filters.industries?.length) {
      whereClauses.push(`p.industry IN (:industries)`);
      replacements.industries = filters.industries;
    }

    // Location filter (trigram similarity)
    if (filters.location) {
      whereClauses.push(`p.location % :location`);
      replacements.location = filters.location;
    }

    // Quality score filters
    if (filters.qualities?.length) {
      for (const { quality, minPercentage } of filters.qualities) {
        const col = QUALITY_COLUMN_MAP[quality];
        if (!col) continue;
        const paramName = `min_${quality}`;
        whereClauses.push(`
          p.total_reviews > 0
          AND (p.${col}::FLOAT / p.total_reviews) * 100 >= :${paramName}
        `);
        replacements[paramName] = minPercentage;
      }
    }

    // Minimum review count
    if (filters.minReviewCount && filters.minReviewCount > 0) {
      whereClauses.push(`p.total_reviews >= :minReviewCount`);
      replacements.minReviewCount = filters.minReviewCount;
    }

    // Active in last N months
    if (filters.activeInLastMonths && filters.activeInLastMonths > 0) {
      whereClauses.push(`
        EXISTS (
          SELECT 1 FROM reviews r_active
          WHERE r_active.profile_id = p.id
            AND r_active.created_at >= NOW() - INTERVAL '${filters.activeInLastMonths} months'
        )
      `);
    }

    // Minimum verified interaction rate
    if (filters.minVerifiedRate && filters.minVerifiedRate > 0) {
      whereClauses.push(`
        COALESCE(verified_stats.verified_rate, 0) * 100 >= :minVerifiedRate
      `);
      replacements.minVerifiedRate = filters.minVerifiedRate;
    }

    // Has video filter
    if (filters.hasVideo === true) {
      whereClauses.push(`COALESCE(media_stats.has_video, FALSE) = TRUE`);
    }

    // Cursor-based pagination
    if (filters.cursor) {
      const [cursorScore, cursorId] = filters.cursor.split(':');
      whereClauses.push(`(
        (
          0.30 * LEAST(p.total_reviews / 50.0, 1.0)
          + 0.25 * COALESCE(
              GREATEST(p.expertise_count, p.care_count, p.delivery_count,
                       p.initiative_count, p.trust_count)::FLOAT
              / NULLIF(p.total_reviews, 0),
              0
            )
          + 0.20 * COALESCE(verified_stats.verified_rate, 0)
          + 0.15 * COALESCE(LEAST(recency_stats.recent_count / 10.0, 1.0), 0)
          + 0.10 * COALESCE(media_stats.has_rich_media, 0)
          + CASE WHEN sub.tier = 'pro_individual' AND sub.status = 'active' THEN 0.10 ELSE 0 END
        ) < :cursorScore
        OR (
          (
            0.30 * LEAST(p.total_reviews / 50.0, 1.0)
            + 0.25 * COALESCE(
                GREATEST(p.expertise_count, p.care_count, p.delivery_count,
                         p.initiative_count, p.trust_count)::FLOAT
                / NULLIF(p.total_reviews, 0),
                0
              )
            + 0.20 * COALESCE(verified_stats.verified_rate, 0)
            + 0.15 * COALESCE(LEAST(recency_stats.recent_count / 10.0, 1.0), 0)
            + 0.10 * COALESCE(media_stats.has_rich_media, 0)
            + CASE WHEN sub.tier = 'pro_individual' AND sub.status = 'active' THEN 0.10 ELSE 0 END
          ) = :cursorScore AND p.id > :cursorId
        )
      )`);
      replacements.cursorScore = parseFloat(cursorScore);
      replacements.cursorId = cursorId;
    }

    const whereSQL = whereClauses.join('\n  AND ');

    const sql = `
      SELECT
        p.id AS "profileId",
        p.slug,
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl",
        p.industry,
        p.location,
        p.headline,
        p.total_reviews AS "totalReviews",
        p.expertise_count AS "expertiseCount",
        p.care_count AS "careCount",
        p.delivery_count AS "deliveryCount",
        p.initiative_count AS "initiativeCount",
        p.trust_count AS "trustCount",
        COALESCE(media_stats.has_video, FALSE) AS "hasVideo",
        COALESCE(verified_stats.verified_rate, 0) AS "verifiedRate",
        COALESCE(recency_stats.recent_count, 0) AS "recentCount",
        CASE WHEN sub.tier = 'pro_individual' AND sub.status = 'active' THEN TRUE ELSE FALSE END AS "isPro",
        (
          0.30 * LEAST(p.total_reviews / 50.0, 1.0)
          + 0.25 * COALESCE(
              GREATEST(p.expertise_count, p.care_count, p.delivery_count,
                       p.initiative_count, p.trust_count)::FLOAT
              / NULLIF(p.total_reviews, 0),
              0
            )
          + 0.20 * COALESCE(verified_stats.verified_rate, 0)
          + 0.15 * COALESCE(LEAST(recency_stats.recent_count / 10.0, 1.0), 0)
          + 0.10 * COALESCE(media_stats.has_rich_media, 0)
          + CASE WHEN sub.tier = 'pro_individual' AND sub.status = 'active' THEN 0.10 ELSE 0 END
        ) AS "compositeScore"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN subscriptions sub ON sub.user_id = p.user_id AND sub.status = 'active'
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE r.is_verified_interaction = TRUE)::FLOAT
            / NULLIF(COUNT(*), 0) AS verified_rate
        FROM reviews r
        WHERE r.profile_id = p.id
      ) verified_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS recent_count
        FROM reviews r
        WHERE r.profile_id = p.id
          AND r.created_at >= NOW() - INTERVAL '90 days'
      ) recency_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          BOOL_OR(rm.media_type = 'video') AS has_video,
          CASE WHEN BOOL_OR(rm.media_type IN ('video', 'voice')) THEN 1.0 ELSE 0.0 END AS has_rich_media
        FROM review_media rm
        INNER JOIN reviews r ON r.id = rm.review_id
        WHERE r.profile_id = p.id
      ) media_stats ON TRUE
      WHERE ${whereSQL}
      ORDER BY "compositeScore" DESC, p.id ASC
      LIMIT :limit
    `;

    replacements.limit = limit + 1;

    const rows = await sequelize.query<any>(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });

    const hasMore = rows.length > limit;
    const results: SearchResult[] = (hasMore ? rows.slice(0, limit) : rows).map((row: any) => ({
      profileId: row.profileId,
      slug: row.slug,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
      industry: row.industry,
      location: row.location,
      headline: row.headline,
      totalReviews: Number(row.totalReviews),
      qualityBreakdown: {
        expertise: Number(row.expertiseCount),
        care: Number(row.careCount),
        delivery: Number(row.deliveryCount),
        initiative: Number(row.initiativeCount),
        trust: Number(row.trustCount),
      },
      hasVideo: Boolean(row.hasVideo),
      verifiedRate: Number(row.verifiedRate),
      recentCount: Number(row.recentCount),
      compositeScore: Number(row.compositeScore),
      isPro: Boolean(row.isPro),
    }));

    let nextCursor: string | null = null;
    if (hasMore && results.length > 0) {
      const last = results[results.length - 1];
      nextCursor = `${last.compositeScore}:${last.profileId}`;
    }

    return { results, nextCursor, hasMore };
  }

  async logProfileView(recruiterUserId: string, profileId: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `INSERT INTO profile_views (id, recruiter_user_id, profile_id, viewed_at)
       VALUES (gen_random_uuid(), :recruiterUserId, :profileId, NOW())`,
      {
        replacements: { recruiterUserId, profileId },
        type: QueryTypes.INSERT,
      },
    );
  }

  async findProfileForView(profileId: string): Promise<any | null> {
    const sequelize = getSequelize();
    const [row] = await sequelize.query<any>(
      `SELECT
        p.id AS "profileId",
        p.slug,
        u.display_name AS "displayName",
        u.avatar_url AS "avatarUrl",
        p.industry,
        p.location,
        p.headline,
        p.total_reviews AS "totalReviews",
        p.expertise_count AS "expertiseCount",
        p.care_count AS "careCount",
        p.delivery_count AS "deliveryCount",
        p.initiative_count AS "initiativeCount",
        p.trust_count AS "trustCount",
        COALESCE(media_stats.has_video, FALSE) AS "hasVideo",
        COALESCE(verified_stats.verified_rate, 0) AS "verifiedRate",
        COALESCE(ref_stats.ref_count, 0) AS "verifiableReferenceCount",
        CASE WHEN sub.tier = 'pro_individual' AND sub.status = 'active' THEN TRUE ELSE FALSE END AS "isPro"
      FROM profiles p
      INNER JOIN users u ON u.id = p.user_id
      LEFT JOIN subscriptions sub ON sub.user_id = p.user_id AND sub.status = 'active'
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE r.is_verified_interaction = TRUE)::FLOAT
            / NULLIF(COUNT(*), 0) AS verified_rate
        FROM reviews r
        WHERE r.profile_id = p.id
      ) verified_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          BOOL_OR(rm.media_type = 'video') AS has_video
        FROM review_media rm
        INNER JOIN reviews r ON r.id = rm.review_id
        WHERE r.profile_id = p.id
      ) media_stats ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS ref_count
        FROM verifiable_references vr
        INNER JOIN reviews r ON r.id = vr.review_id
        WHERE r.profile_id = p.id AND vr.is_contactable = true
      ) ref_stats ON TRUE
      WHERE p.id = :profileId
        AND p.visibility IN ('recruiter_visible', 'public')`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      },
    );

    return row || null;
  }

  async countContactRequestsToday(recruiterUserId: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM contact_requests
       WHERE recruiter_user_id = :recruiterUserId
         AND created_at >= CURRENT_DATE`,
      {
        replacements: { recruiterUserId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async isRecruiterBlocked(profileId: string, recruiterUserId: string): Promise<boolean> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM recruiter_blocks
       WHERE profile_id = :profileId AND recruiter_user_id = :recruiterUserId`,
      {
        replacements: { profileId, recruiterUserId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count) > 0;
  }

  async hasPendingContactRequest(recruiterUserId: string, profileId: string): Promise<boolean> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM contact_requests
       WHERE recruiter_user_id = :recruiterUserId
         AND profile_id = :profileId
         AND status = 'pending'`,
      {
        replacements: { recruiterUserId, profileId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count) > 0;
  }

  async createContactRequest(
    recruiterUserId: string,
    profileId: string,
    data: { subject: string; message: string; hiringRole: string; companyName: string },
  ): Promise<any> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `INSERT INTO contact_requests (id, recruiter_user_id, profile_id, subject, message, hiring_role, company_name, status, created_at, updated_at)
       VALUES (gen_random_uuid(), :recruiterUserId, :profileId, :subject, :message, :hiringRole, :companyName, 'pending', NOW(), NOW())
       RETURNING id, recruiter_user_id AS "recruiterUserId", profile_id AS "profileId",
                 subject, message, hiring_role AS "hiringRole", company_name AS "companyName",
                 status, responded_at AS "respondedAt", created_at AS "createdAt"`,
      {
        replacements: { recruiterUserId, profileId, ...data },
        type: QueryTypes.SELECT,
      },
    );
    return result;
  }

  async findContactRequests(recruiterUserId: string): Promise<any[]> {
    const sequelize = getSequelize();
    return sequelize.query<any>(
      `SELECT id, recruiter_user_id AS "recruiterUserId", profile_id AS "profileId",
              subject, message, hiring_role AS "hiringRole", company_name AS "companyName",
              status, responded_at AS "respondedAt", created_at AS "createdAt"
       FROM contact_requests
       WHERE recruiter_user_id = :recruiterUserId
       ORDER BY created_at DESC`,
      {
        replacements: { recruiterUserId },
        type: QueryTypes.SELECT,
      },
    );
  }

  async getProfileVisibility(profileId: string): Promise<string | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ visibility: string }>(
      `SELECT visibility FROM profiles WHERE id = :profileId`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      },
    );
    return result?.visibility ?? null;
  }
}
