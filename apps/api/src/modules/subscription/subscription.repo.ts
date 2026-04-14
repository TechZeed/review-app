import { QueryTypes } from 'sequelize';
import { getSequelize } from '../../config/sequelize.js';
import type { SubscriptionRecord } from './subscription.types.js';

export class SubscriptionRepository {
  async findByUserId(userId: string): Promise<SubscriptionRecord | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<SubscriptionRecord>(
      `SELECT
        id, user_id AS "userId", tier, status,
        stripe_customer_id AS "stripeCustomerId",
        stripe_subscription_id AS "stripeSubscriptionId",
        stripe_price_id AS "stripePriceId",
        billing_cycle AS "billingCycle",
        quantity,
        cancel_at_period_end AS "cancelAtPeriodEnd",
        cancelled_at AS "cancelledAt",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM subscriptions
      WHERE user_id = :userId
      ORDER BY created_at DESC
      LIMIT 1`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async findActiveByUserId(userId: string): Promise<SubscriptionRecord | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<SubscriptionRecord>(
      `SELECT
        id, user_id AS "userId", tier, status,
        stripe_customer_id AS "stripeCustomerId",
        stripe_subscription_id AS "stripeSubscriptionId",
        stripe_price_id AS "stripePriceId",
        billing_cycle AS "billingCycle",
        quantity,
        cancel_at_period_end AS "cancelAtPeriodEnd",
        cancelled_at AS "cancelledAt",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM subscriptions
      WHERE user_id = :userId
        AND status IN ('active', 'trialing')
      ORDER BY created_at DESC
      LIMIT 1`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async findByStripeCustomerId(stripeCustomerId: string): Promise<SubscriptionRecord | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<SubscriptionRecord>(
      `SELECT
        id, user_id AS "userId", tier, status,
        stripe_customer_id AS "stripeCustomerId",
        stripe_subscription_id AS "stripeSubscriptionId",
        stripe_price_id AS "stripePriceId",
        billing_cycle AS "billingCycle",
        quantity,
        cancel_at_period_end AS "cancelAtPeriodEnd",
        cancelled_at AS "cancelledAt",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM subscriptions
      WHERE stripe_customer_id = :stripeCustomerId
      ORDER BY created_at DESC
      LIMIT 1`,
      {
        replacements: { stripeCustomerId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async findByStripeSubscriptionId(stripeSubscriptionId: string): Promise<SubscriptionRecord | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<SubscriptionRecord>(
      `SELECT
        id, user_id AS "userId", tier, status,
        stripe_customer_id AS "stripeCustomerId",
        stripe_subscription_id AS "stripeSubscriptionId",
        stripe_price_id AS "stripePriceId",
        billing_cycle AS "billingCycle",
        quantity,
        cancel_at_period_end AS "cancelAtPeriodEnd",
        cancelled_at AS "cancelledAt",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM subscriptions
      WHERE stripe_subscription_id = :stripeSubscriptionId
      ORDER BY created_at DESC
      LIMIT 1`,
      {
        replacements: { stripeSubscriptionId },
        type: QueryTypes.SELECT,
      },
    );
    return result || null;
  }

  async createSubscription(data: {
    userId: string;
    tier: string;
    status: string;
    stripeCustomerId: string;
    stripeSubscriptionId: string;
    stripePriceId?: string;
    billingCycle?: string;
    quantity?: number;
    currentPeriodStart?: Date;
    currentPeriodEnd?: Date;
  }): Promise<SubscriptionRecord> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<SubscriptionRecord>(
      `INSERT INTO subscriptions
        (id, user_id, tier, status, stripe_customer_id, stripe_subscription_id,
         stripe_price_id, billing_cycle, quantity,
         current_period_start, current_period_end, created_at, updated_at)
       VALUES
        (gen_random_uuid(), :userId, :tier, :status, :stripeCustomerId, :stripeSubscriptionId,
         :stripePriceId, :billingCycle, :quantity,
         :currentPeriodStart, :currentPeriodEnd, NOW(), NOW())
       RETURNING
        id, user_id AS "userId", tier, status,
        stripe_customer_id AS "stripeCustomerId",
        stripe_subscription_id AS "stripeSubscriptionId",
        stripe_price_id AS "stripePriceId",
        billing_cycle AS "billingCycle",
        quantity,
        cancel_at_period_end AS "cancelAtPeriodEnd",
        cancelled_at AS "cancelledAt",
        current_period_start AS "currentPeriodStart",
        current_period_end AS "currentPeriodEnd",
        created_at AS "createdAt",
        updated_at AS "updatedAt"`,
      {
        replacements: {
          userId: data.userId,
          tier: data.tier,
          status: data.status,
          stripeCustomerId: data.stripeCustomerId,
          stripeSubscriptionId: data.stripeSubscriptionId,
          stripePriceId: data.stripePriceId ?? null,
          billingCycle: data.billingCycle ?? null,
          quantity: data.quantity ?? 1,
          currentPeriodStart: data.currentPeriodStart ?? null,
          currentPeriodEnd: data.currentPeriodEnd ?? null,
        },
        type: QueryTypes.SELECT,
      },
    );
    return result;
  }

  async updateSubscription(
    id: string,
    data: Partial<{
      tier: string;
      status: string;
      stripePriceId: string;
      billingCycle: string;
      quantity: number;
      cancelAtPeriodEnd: boolean;
      cancelledAt: Date | null;
      currentPeriodStart: Date | null;
      currentPeriodEnd: Date | null;
    }>,
  ): Promise<void> {
    const sequelize = getSequelize();
    const setClauses: string[] = ['updated_at = NOW()'];
    const replacements: Record<string, unknown> = { id };

    if (data.tier !== undefined) {
      setClauses.push('tier = :tier');
      replacements.tier = data.tier;
    }
    if (data.status !== undefined) {
      setClauses.push('status = :status');
      replacements.status = data.status;
    }
    if (data.stripePriceId !== undefined) {
      setClauses.push('stripe_price_id = :stripePriceId');
      replacements.stripePriceId = data.stripePriceId;
    }
    if (data.billingCycle !== undefined) {
      setClauses.push('billing_cycle = :billingCycle');
      replacements.billingCycle = data.billingCycle;
    }
    if (data.quantity !== undefined) {
      setClauses.push('quantity = :quantity');
      replacements.quantity = data.quantity;
    }
    if (data.cancelAtPeriodEnd !== undefined) {
      setClauses.push('cancel_at_period_end = :cancelAtPeriodEnd');
      replacements.cancelAtPeriodEnd = data.cancelAtPeriodEnd;
    }
    if (data.cancelledAt !== undefined) {
      setClauses.push('cancelled_at = :cancelledAt');
      replacements.cancelledAt = data.cancelledAt;
    }
    if (data.currentPeriodStart !== undefined) {
      setClauses.push('current_period_start = :currentPeriodStart');
      replacements.currentPeriodStart = data.currentPeriodStart;
    }
    if (data.currentPeriodEnd !== undefined) {
      setClauses.push('current_period_end = :currentPeriodEnd');
      replacements.currentPeriodEnd = data.currentPeriodEnd;
    }

    await sequelize.query(
      `UPDATE subscriptions SET ${setClauses.join(', ')} WHERE id = :id`,
      { replacements, type: QueryTypes.UPDATE },
    );
  }

  async isWebhookEventProcessed(stripeEventId: string): Promise<boolean> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM stripe_webhook_events WHERE stripe_event_id = :stripeEventId`,
      {
        replacements: { stripeEventId },
        type: QueryTypes.SELECT,
      },
    );
    return Number(result.count) > 0;
  }

  async recordWebhookEvent(stripeEventId: string, eventType: string): Promise<void> {
    const sequelize = getSequelize();
    await sequelize.query(
      `INSERT INTO stripe_webhook_events (id, stripe_event_id, event_type, processed_at)
       VALUES (gen_random_uuid(), :stripeEventId, :eventType, NOW())
       ON CONFLICT (stripe_event_id) DO NOTHING`,
      {
        replacements: { stripeEventId, eventType },
        type: QueryTypes.INSERT,
      },
    );
  }

  async findUserEmail(userId: string): Promise<string | null> {
    const sequelize = getSequelize();
    const [result] = await sequelize.query<{ email: string }>(
      `SELECT email FROM users WHERE id = :userId`,
      {
        replacements: { userId },
        type: QueryTypes.SELECT,
      },
    );
    return result?.email ?? null;
  }
}
