export enum SubscriptionTier {
  FREE = 'free',
  PRO = 'pro',
  EMPLOYER = 'employer',
  RECRUITER = 'recruiter',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  PAST_DUE = 'past_due',
  CANCELLED = 'cancelled',
  TRIALING = 'trialing',
  INCOMPLETE = 'incomplete',
}

export enum WebhookEventType {
  CHECKOUT_SESSION_COMPLETED = 'checkout.session.completed',
  SUBSCRIPTION_UPDATED = 'customer.subscription.updated',
  SUBSCRIPTION_DELETED = 'customer.subscription.deleted',
  INVOICE_PAYMENT_FAILED = 'invoice.payment_failed',
  INVOICE_PAID = 'invoice.paid',
}

export interface CreateCheckoutInput {
  tier: string;
  billingCycle: 'monthly' | 'annual';
  successUrl: string;
  cancelUrl: string;
  locationCount?: number;
  seatCount?: number;
}

export interface SubscriptionResponse {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  quantity: number;
  createdAt: string;
}

export interface CheckoutResponse {
  checkoutSessionId: string;
  checkoutUrl: string;
  expiresAt: number;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  tier: string;
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  stripePriceId: string | null;
  billingCycle: string | null;
  quantity: number;
  cancelAtPeriodEnd: boolean;
  cancelledAt: Date | null;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
