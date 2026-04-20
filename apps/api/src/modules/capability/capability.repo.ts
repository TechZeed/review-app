import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../config/sequelize.js';

export type CapabilityName = 'pro' | 'employer' | 'recruiter';
export type CapabilitySource = 'subscription' | 'admin-grant';

export interface ActiveCapability {
  capability: string;
  source: string;
  expiresAt: string | null;
}

export interface UpsertCapabilityInput {
  userId: string;
  capability: CapabilityName | string;
  source: CapabilitySource | string;
  subscriptionId?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown> | null;
}

export class CapabilityRepo {
  async isActive(userId: string, capability: string): Promise<boolean> {
    const sequelize = getSequelize();
    const rows = await sequelize.query<{ one: number }>(
      `SELECT 1 AS one FROM user_capabilities
       WHERE user_id = :userId
         AND capability = :capability
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      {
        replacements: { userId, capability },
        type: QueryTypes.SELECT,
      },
    );
    return rows.length > 0;
  }

  async listActive(userId: string): Promise<ActiveCapability[]> {
    const sequelize = getSequelize();
    const rows = await sequelize.query<ActiveCapability>(
      `SELECT capability,
              source,
              expires_at AS "expiresAt"
       FROM user_capabilities
       WHERE user_id = :userId
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY granted_at DESC`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
    return rows.map((r) => ({
      capability: r.capability,
      source: r.source,
      expiresAt: r.expiresAt ? new Date(r.expiresAt as any).toISOString() : null,
    }));
  }

  async listActiveNames(userId: string): Promise<string[]> {
    const active = await this.listActive(userId);
    return Array.from(new Set(active.map((c) => c.capability)));
  }

  async upsert(input: UpsertCapabilityInput): Promise<void> {
    const sequelize = getSequelize();
    // Partial unique indices can't anchor ON CONFLICT without a matching
    // constraint, so do a find-then-update-or-insert in a short transaction.
    await sequelize.transaction(async (tx) => {
      const existing = await sequelize.query<{ id: string }>(
        `SELECT id FROM user_capabilities
         WHERE user_id = :userId
           AND capability = :capability
           AND source = :source
         ORDER BY granted_at DESC
         LIMIT 1`,
        {
          replacements: {
            userId: input.userId,
            capability: input.capability,
            source: input.source,
          },
          type: QueryTypes.SELECT,
          transaction: tx,
        },
      );

      if (existing.length > 0) {
        await sequelize.query(
          `UPDATE user_capabilities
           SET subscription_id = :subscriptionId,
               expires_at = :expiresAt,
               metadata = :metadata,
               updated_at = NOW()
           WHERE id = :id`,
          {
            replacements: {
              id: existing[0].id,
              subscriptionId: input.subscriptionId ?? null,
              expiresAt: input.expiresAt ?? null,
              metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            },
            type: QueryTypes.UPDATE,
            transaction: tx,
          },
        );
      } else {
        await sequelize.query(
          `INSERT INTO user_capabilities
             (id, user_id, capability, source, subscription_id, granted_at, expires_at, metadata, created_at, updated_at)
           VALUES
             (gen_random_uuid(), :userId, :capability, :source, :subscriptionId, NOW(), :expiresAt, :metadata, NOW(), NOW())`,
          {
            replacements: {
              userId: input.userId,
              capability: input.capability,
              source: input.source,
              subscriptionId: input.subscriptionId ?? null,
              expiresAt: input.expiresAt ?? null,
              metadata: input.metadata ? JSON.stringify(input.metadata) : null,
            },
            type: QueryTypes.INSERT,
            transaction: tx,
          },
        );
      }
    });
  }

  async cleanupInstantExpirySubscriptionRows(userId: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `DELETE FROM user_capabilities
       WHERE user_id = :userId
         AND source = 'subscription'
         AND expires_at IS NOT NULL
         AND expires_at < created_at + INTERVAL '5 minutes'`,
      {
        replacements: { userId },
        type: QueryTypes.DELETE,
      },
    );
  }

  async setExpiry(subscriptionId: string, expiresAt: Date): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `UPDATE user_capabilities
       SET expires_at = :expiresAt, updated_at = NOW()
       WHERE subscription_id = :subscriptionId`,
      {
        replacements: { subscriptionId, expiresAt },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async revoke(userId: string, capability: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `UPDATE user_capabilities
       SET expires_at = NOW(), updated_at = NOW()
       WHERE user_id = :userId
         AND capability = :capability
         AND (expires_at IS NULL OR expires_at > NOW())`,
      {
        replacements: { userId, capability },
        type: QueryTypes.UPDATE,
      },
    );
  }

  async grantByAdmin(input: {
    userId: string;
    capability: string;
    expiresAt?: Date | null;
    adminUserId: string;
    reason?: string | null;
  }): Promise<void> {
    await this.upsert({
      userId: input.userId,
      capability: input.capability,
      source: 'admin-grant',
      subscriptionId: null,
      expiresAt: input.expiresAt ?? null,
      metadata: {
        granted_by: input.adminUserId,
        reason: input.reason ?? null,
      },
    });
  }
}

export const capabilityRepo = new CapabilityRepo();
