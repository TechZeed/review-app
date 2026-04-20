import Stripe from 'stripe';
import { getStripe } from '../../config/stripe.js';
import { env } from '../../config/env.js';
import { SubscriptionRepository } from './subscription.repo.js';
import { capabilityRepo } from '../capability/capability.repo.js';
import { AppError } from '../../shared/errors/appError.js';
import { logger } from '../../config/logger.js';
import type {
  CreateCheckoutInput,
  CheckoutResponse,
  PortalSessionResponse,
  SubscriptionResponse,
  SubscriptionRecord,
} from './subscription.types.js';

function getPriceMap(): Record<string, string | undefined> {
  return {
    'pro_individual:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'pro_individual:annual': process.env.STRIPE_PRICE_PRO_ANNUAL,
    'employer_small:monthly': process.env.STRIPE_PRICE_EMPLOYER_SMALL,
    'employer_medium:monthly': process.env.STRIPE_PRICE_EMPLOYER_MEDIUM,
    'employer_large:monthly': process.env.STRIPE_PRICE_EMPLOYER_LARGE,
    'recruiter_basic:monthly': process.env.STRIPE_PRICE_RECRUITER_BASIC,
    'recruiter_premium:monthly': process.env.STRIPE_PRICE_RECRUITER_PREMIUM,
  };
}

const TIER_TO_DB_TIER: Record<string, string> = {
  pro_individual: 'pro',
  employer_small: 'employer',
  employer_medium: 'employer',
  employer_large: 'employer',
  recruiter_basic: 'recruiter',
  recruiter_premium: 'recruiter',
};

export class SubscriptionService {
  constructor(private repo: SubscriptionRepository) {}

  private resolvePortalReturnUrl(returnUrl?: string): string {
    const defaultUrl = `${env.FRONTEND_URL}/billing`;
    if (!returnUrl) return defaultUrl;

    let candidate: URL;
    let expected: URL;
    try {
      candidate = new URL(returnUrl);
      expected = new URL(env.FRONTEND_URL);
    } catch (error) {
      const sanitizedReturnUrl = returnUrl.replace(/[\r\n\t]/g, '').slice(0, 512);
      logger.warn('Invalid portal return URL', { returnUrl: sanitizedReturnUrl, frontendUrl: env.FRONTEND_URL, error });
      throw new AppError('Invalid return URL', 400, 'INVALID_RETURN_URL');
    }

    if (candidate.origin !== expected.origin) {
      throw new AppError('Invalid return URL origin', 400, 'INVALID_RETURN_URL');
    }

    return returnUrl;
  }

  private expectedCapabilityForPaidTier(tier: string): 'pro' | 'employer' | 'recruiter' | null {
    if (tier === 'pro' || tier === 'employer' || tier === 'recruiter') return tier;
    return null;
  }

  private computeReconciliation(
    sub: SubscriptionRecord | null,
    capabilities: Array<{ capability: string; source: string }>,
  ): { consistent: boolean; issues: Array<'tier-without-capability' | 'orphan-capability'> } {
    const issues: Array<'tier-without-capability' | 'orphan-capability'> = [];
    const isActiveSub = sub && (sub.status === 'active' || sub.status === 'trialing');
    const expectedCapability = isActiveSub ? this.expectedCapabilityForPaidTier(sub.tier) : null;

    if (
      expectedCapability &&
      !capabilities.some((cap) => cap.capability === expectedCapability)
    ) {
      issues.push('tier-without-capability');
    }

    if (capabilities.length > 1) {
      const hasMatchingActiveSubCapability =
        Boolean(expectedCapability) &&
        capabilities.some((cap) => cap.capability === expectedCapability);
      if (!hasMatchingActiveSubCapability) {
        issues.push('orphan-capability');
      }
    }

    return { consistent: issues.length === 0, issues };
  }

  async createCheckoutSession(
    userId: string,
    input: CreateCheckoutInput,
  ): Promise<CheckoutResponse> {
    const stripe = getStripe();

    // Check for active subscription
    const existing = await this.repo.findActiveByUserId(userId);
    if (existing) {
      throw new AppError(
        'Active subscription already exists',
        409,
        'ACTIVE_SUBSCRIPTION_EXISTS',
      );
    }

    // Resolve price ID
    const priceKey = `${input.tier}:${input.billingCycle}`;
    const priceId = getPriceMap()[priceKey];
    if (!priceId) {
      throw new AppError(
        `Invalid tier/billing combination: ${priceKey}`,
        400,
        'INVALID_TIER',
      );
    }

    // Determine quantity
    let quantity = 1;
    if (input.tier.startsWith('employer_')) {
      if (!input.locationCount || input.locationCount < 1) {
        throw new AppError('locationCount is required for employer tiers', 400, 'VALIDATION_ERROR');
      }
      quantity = input.locationCount;
    } else if (input.tier.startsWith('recruiter_')) {
      if (!input.seatCount || input.seatCount < 1) {
        throw new AppError('seatCount is required for recruiter tiers', 400, 'VALIDATION_ERROR');
      }
      quantity = input.seatCount;
    }

    // Get or create Stripe customer
    const email = await this.repo.findUserEmail(userId);
    let stripeCustomerId: string;

    const existingSub = await this.repo.findByUserId(userId);
    if (existingSub?.stripeCustomerId) {
      stripeCustomerId = existingSub.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: email ?? undefined,
        metadata: { user_id: userId },
      });
      stripeCustomerId = customer.id;
    }

    // Build discount array for employer volume discounts
    const discounts: Stripe.Checkout.SessionCreateParams.Discount[] = [];
    if (input.tier.startsWith('employer_') && input.locationCount && input.locationCount >= 10) {
      // Volume discount coupons would be pre-created in Stripe
      // This is a placeholder for the coupon application
      logger.info(`Volume discount applicable for ${input.locationCount} locations`);
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{
        price: priceId,
        quantity,
      }],
      subscription_data: {
        metadata: {
          user_id: userId,
          app_tier: input.tier,
        },
      },
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      metadata: {
        user_id: userId,
        app_tier: input.tier,
      },
      ...(discounts.length > 0 ? { discounts } : {}),
    });

    return {
      checkoutSessionId: session.id,
      checkoutUrl: session.url!,
      expiresAt: session.expires_at!,
    };
  }

  async getMySubscription(userId: string): Promise<SubscriptionResponse> {
    const sub = await this.repo.findByUserId(userId);
    let capabilities = await capabilityRepo.listActive(userId);
    const reconciliation = this.computeReconciliation(sub, capabilities);
    let responseReconciliation = reconciliation;

    if (
      reconciliation.issues.includes('tier-without-capability') &&
      sub &&
      (sub.status === 'active' || sub.status === 'trialing')
    ) {
      const expectedCapability = this.expectedCapabilityForPaidTier(sub.tier);
      if (expectedCapability) {
        await capabilityRepo.upsert({
          userId,
          capability: expectedCapability,
          source: 'subscription',
          subscriptionId: sub.id,
          expiresAt: sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null,
          metadata: { self_healed: true },
        });
        capabilities = await capabilityRepo.listActive(userId);
      }
    }

    if (!sub) {
      return {
        id: '',
        userId,
        tier: 'free',
        status: 'none',
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        quantity: 1,
        createdAt: new Date().toISOString(),
        capabilities,
        reconciliation: this.computeReconciliation(null, capabilities),
      };
    }

    const response = this.toResponse(sub);
    response.capabilities = capabilities;
    response.reconciliation = responseReconciliation;
    return response;
  }

  async listActiveCapabilities(userId: string) {
    return capabilityRepo.listActive(userId);
  }

  async createPortalSession(userId: string, returnUrl?: string): Promise<PortalSessionResponse> {
    const stripe = getStripe();
    const sub = await this.repo.findActiveByUserId(userId);

    if (!sub) {
      throw new AppError('No active subscription found', 400, 'NO_ACTIVE_SUBSCRIPTION');
    }

    if (!sub.stripeCustomerId) {
      throw new AppError('No Stripe customer ID found', 400, 'NO_STRIPE_CUSTOMER');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: this.resolvePortalReturnUrl(returnUrl),
    });

    return {
      portalUrl: session.url,
    };
  }

  async cancelSubscription(userId: string, immediate: boolean = false): Promise<SubscriptionResponse> {
    const stripe = getStripe();

    const sub = await this.repo.findActiveByUserId(userId);
    if (!sub) {
      throw new AppError('No active subscription found', 400, 'NO_ACTIVE_SUBSCRIPTION');
    }

    if (!sub.stripeSubscriptionId) {
      throw new AppError('No Stripe subscription ID found', 400, 'NO_STRIPE_SUBSCRIPTION');
    }

    if (immediate) {
      await stripe.subscriptions.cancel(sub.stripeSubscriptionId);
      await this.repo.updateSubscription(sub.id, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelAtPeriodEnd: false,
      });
    } else {
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
      await this.repo.updateSubscription(sub.id, {
        cancelAtPeriodEnd: true,
      });
    }

    const updated = await this.repo.findByUserId(userId);
    return this.toResponse(updated!);
  }

  async handleWebhookEvent(event: Stripe.Event): Promise<void> {
    // Idempotency check
    const processed = await this.repo.isWebhookEventProcessed(event.id);
    if (processed) {
      logger.info(`Webhook event ${event.id} already processed, skipping`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.paid':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      default:
        logger.warn(`Unhandled webhook event type: ${event.type}`);
    }

    // Record the event for idempotency
    await this.repo.recordWebhookEvent(event.id, event.type);
  }

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.metadata?.user_id;
    const appTier = session.metadata?.app_tier;

    if (!userId || !appTier) {
      logger.warn('Checkout session missing metadata', { sessionId: session.id });
      return;
    }

    const stripe = getStripe();
    const stripeSubscription = await stripe.subscriptions.retrieve(
      session.subscription as string,
    );

    const dbTier = TIER_TO_DB_TIER[appTier] ?? appTier;

    // Check if subscription record already exists for this user
    const existing = await this.repo.findByUserId(userId);

    let subscriptionRowId: string | undefined;

    if (existing && existing.status === 'cancelled') {
      // Re-subscribe: update existing record
      await this.repo.updateSubscription(existing.id, {
        tier: dbTier,
        status: 'active',
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      });
      subscriptionRowId = existing.id;
    } else if (!existing) {
      // New subscription
      const created = await this.repo.createSubscription({
        userId,
        tier: dbTier,
        status: 'active',
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      });
      subscriptionRowId = created.id;
    } else {
      subscriptionRowId = existing.id;
    }

    // Spec 28 — grant the capability matching this paid tier.
    if (dbTier && dbTier !== 'free' && subscriptionRowId) {
      try {
        await capabilityRepo.upsert({
          userId,
          capability: dbTier,
          source: 'subscription',
          subscriptionId: subscriptionRowId,
          expiresAt: null,
          metadata: {
            app_tier: appTier,
            stripe_subscription_id: session.subscription as string,
          },
        });
      } catch (err) {
        logger.error('Failed to upsert capability on subscription activation', { err, userId, tier: dbTier });
      }
    }

    logger.info('Subscription activated', { userId, tier: dbTier });
  }

  private async handleSubscriptionUpdated(subscription: Stripe.Subscription): Promise<void> {
    const sub = await this.repo.findByStripeSubscriptionId(subscription.id);
    if (!sub) {
      logger.warn('Subscription not found for update', { stripeSubscriptionId: subscription.id });
      return;
    }

    const statusMap: Record<string, string> = {
      active: 'active',
      past_due: 'past_due',
      canceled: 'cancelled',
      trialing: 'trialing',
      incomplete: 'incomplete',
    };

    await this.repo.updateSubscription(sub.id, {
      status: statusMap[subscription.status] ?? subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    });

    // Spec 28 — if cancel_at_period_end flipped on, mark the capability as
    // expiring at period_end. Grace until then.
    if (subscription.cancel_at_period_end) {
      try {
        await capabilityRepo.setExpiry(sub.id, new Date(subscription.current_period_end * 1000));
      } catch (err) {
        logger.error('Failed to set capability expiry on cancel_at_period_end', { err, subscriptionId: sub.id });
      }
    }

    logger.info('Subscription updated', { subscriptionId: sub.id, status: subscription.status });
  }

  private async handleSubscriptionDeleted(subscription: Stripe.Subscription): Promise<void> {
    const sub = await this.repo.findByStripeSubscriptionId(subscription.id);
    if (!sub) {
      logger.warn('Subscription not found for deletion', { stripeSubscriptionId: subscription.id });
      return;
    }

    const now = new Date();
    await this.repo.updateSubscription(sub.id, {
      status: 'cancelled',
      tier: 'free',
      cancelledAt: now,
      currentPeriodStart: null,
      currentPeriodEnd: null,
    });

    // Spec 28 — expire the capability immediately when Stripe marks the
    // subscription deleted. If the caller wanted grace, they set
    // cancel_at_period_end and we already set expires_at = current_period_end
    // on that webhook.
    try {
      const periodEnd = subscription.current_period_end
        ? new Date(subscription.current_period_end * 1000)
        : now;
      await capabilityRepo.setExpiry(sub.id, periodEnd);
    } catch (err) {
      logger.error('Failed to set capability expiry on subscription deleted', { err, subscriptionId: sub.id });
    }

    logger.info('Subscription deactivated', { subscriptionId: sub.id });
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = invoice.subscription as string;
    if (!stripeSubscriptionId) return;

    const sub = await this.repo.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!sub) {
      logger.warn('Subscription not found for payment failure', { stripeSubscriptionId });
      return;
    }

    await this.repo.updateSubscription(sub.id, {
      status: 'past_due',
    });

    logger.info('Payment failed, subscription set to past_due', { subscriptionId: sub.id });
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubscriptionId = invoice.subscription as string;
    if (!stripeSubscriptionId) return;

    const sub = await this.repo.findByStripeSubscriptionId(stripeSubscriptionId);
    if (!sub) {
      logger.warn('Subscription not found for payment success', { stripeSubscriptionId });
      return;
    }

    const updates: Record<string, any> = {};
    if (sub.status === 'past_due') {
      updates.status = 'active';
    }

    const period = invoice.lines?.data?.[0]?.period;
    if (period) {
      updates.currentPeriodStart = new Date(period.start * 1000);
      updates.currentPeriodEnd = new Date(period.end * 1000);
    }

    if (Object.keys(updates).length > 0) {
      await this.repo.updateSubscription(sub.id, updates);
    }

    logger.info('Payment succeeded', { subscriptionId: sub.id });
  }

  private toResponse(sub: SubscriptionRecord): SubscriptionResponse {
    return {
      id: sub.id,
      userId: sub.userId,
      tier: sub.tier,
      status: sub.status,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      currentPeriodStart: sub.currentPeriodStart
        ? new Date(sub.currentPeriodStart).toISOString()
        : null,
      currentPeriodEnd: sub.currentPeriodEnd
        ? new Date(sub.currentPeriodEnd).toISOString()
        : null,
      cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
      quantity: sub.quantity ?? 1,
      createdAt: new Date(sub.createdAt).toISOString(),
      capabilities: [],
      reconciliation: {
        consistent: true,
        issues: [],
      },
    };
  }
}
