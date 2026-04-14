import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../config/sequelize.js';

export class ReferenceRepository {
  async findByReview(reviewId: string): Promise<any | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `SELECT
        id, review_id AS "reviewId",
        reviewer_phone_hash AS "reviewerPhoneHash",
        is_contactable AS "isContactable",
        opted_in_at AS "optedInAt",
        withdrawn_at AS "withdrawnAt",
        contact_count AS "contactCount",
        non_response_count AS "nonResponseCount"
      FROM verifiable_references
      WHERE review_id = :reviewId`,
      {
        replacements: { reviewId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async findById(id: string): Promise<any | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `SELECT
        id, review_id AS "reviewId",
        reviewer_phone_hash AS "reviewerPhoneHash",
        is_contactable AS "isContactable",
        opted_in_at AS "optedInAt",
        withdrawn_at AS "withdrawnAt",
        contact_count AS "contactCount",
        non_response_count AS "nonResponseCount"
      FROM verifiable_references
      WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async findByProfile(profileId: string): Promise<any[]> {
    const sequelize = getSequelize();
    return sequelize.query<any>(
      `SELECT
        vr.id,
        vr.review_id AS "reviewId",
        vr.is_contactable AS "isContactable",
        vr.opted_in_at AS "optedInAt",
        vr.withdrawn_at AS "withdrawnAt",
        vr.contact_count AS "contactCount",
        vr.non_response_count AS "nonResponseCount"
      FROM verifiable_references vr
      INNER JOIN reviews r ON r.id = vr.review_id
      WHERE r.profile_id = :profileId
      ORDER BY vr.opted_in_at DESC`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      },
    );
  }

  async countContactable(profileId: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM verifiable_references vr
       INNER JOIN reviews r ON r.id = vr.review_id
       WHERE r.profile_id = :profileId
         AND vr.is_contactable = true`,
      {
        replacements: { profileId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async createReference(data: {
    reviewId: string;
    reviewerPhoneHash: string;
  }): Promise<any> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<any>(
      `INSERT INTO verifiable_references
        (id, review_id, reviewer_phone_hash, is_contactable, opted_in_at, contact_count, non_response_count)
       VALUES
        (gen_random_uuid(), :reviewId, :reviewerPhoneHash, true, NOW(), 0, 0)
       RETURNING
        id, review_id AS "reviewId",
        is_contactable AS "isContactable",
        opted_in_at AS "optedInAt",
        contact_count AS "contactCount",
        non_response_count AS "nonResponseCount"`,
      {
        replacements: { reviewId: data.reviewId, reviewerPhoneHash: data.reviewerPhoneHash },
        type: QueryTypes.SELECT,
      },
    );
    return result;
  }

  async withdrawReference(id: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `UPDATE verifiable_references
       SET is_contactable = false, withdrawn_at = NOW()
       WHERE id = :id`,
      {
        replacements: { id },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async cancelPendingRequests(referenceId: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `UPDATE reference_requests
       SET status = 'expired'
       WHERE verifiable_reference_id = :referenceId
         AND status = 'pending'`,
      {
        replacements: { referenceId },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async closeActiveConversations(referenceId: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `UPDATE relay_conversations
       SET status = 'closed', closed_at = NOW()
       WHERE reference_request_id IN (
         SELECT id FROM reference_requests WHERE verifiable_reference_id = :referenceId
       )
       AND status = 'active'`,
      {
        replacements: { referenceId },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async reviewExistsWithPhone(reviewId: string, reviewerPhoneHash: string): Promise<boolean> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM reviews
       WHERE id = :reviewId AND reviewer_phone_hash = :reviewerPhoneHash`,
      {
        replacements: { reviewId, reviewerPhoneHash },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count) > 0;
  }

  async countRecruiterDailyRequests(recruiterUserId: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM reference_requests
       WHERE requester_user_id = :recruiterUserId
         AND requested_at > NOW() - INTERVAL '24 hours'`,
      {
        replacements: { recruiterUserId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async countReviewLifetimeRequests(referenceId: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM reference_requests
       WHERE verifiable_reference_id = :referenceId`,
      {
        replacements: { referenceId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async countCustomerMonthlyRequests(reviewerPhoneHash: string): Promise<number> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM reference_requests rr
       INNER JOIN verifiable_references vr ON rr.verifiable_reference_id = vr.id
       WHERE vr.reviewer_phone_hash = :reviewerPhoneHash
         AND rr.requested_at > NOW() - INTERVAL '30 days'`,
      {
        replacements: { reviewerPhoneHash },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count);
  }

  async createReferenceRequest(data: {
    referenceId: string;
    recruiterUserId: string;
    companyName: string;
    roleTitle: string;
    message: string;
  }): Promise<any> {
    const sequelize = getSequelize();
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 hours
    const [result] = await sequelize.query<any>(
      `INSERT INTO reference_requests
        (id, verifiable_reference_id, requester_user_id, status,
         company_name, role_title, message, requested_at, expires_at)
       VALUES
        (gen_random_uuid(), :referenceId, :recruiterUserId, 'pending',
         :companyName, :roleTitle, :message, NOW(), :expiresAt)
       RETURNING
        id AS "requestId",
        verifiable_reference_id AS "referenceId",
        status,
        expires_at AS "expiresAt"`,
      {
        replacements: {
          referenceId: data.referenceId,
          recruiterUserId: data.recruiterUserId,
          companyName: data.companyName,
          roleTitle: data.roleTitle,
          message: data.message,
          expiresAt,
        },
        type: QueryTypes.SELECT,
      },
    );
    return result;
  }
}
