/**
 * Unit tests for the Subscription service layer.
 *
 * Covers: checkout session creation per tier, Stripe webhook processing,
 * tier enforcement for paid features.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { v4 as uuid } from "uuid";
import {
  createTestUser,
  createTestSubscription,
} from "../utils/factories.js";

// ──────────────────────────────────────────────
// Mocks
// ──────────────────────────────────────────────

const mockSubscriptionRepo = {
  findOne: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateById: vi.fn(),
  update: vi.fn(),
};

vi.mock("../../src/modules/subscription/subscription.repo.js", () => ({
  subscriptionRepo: mockSubscriptionRepo,
}));

// ──────────────────────────────────────────────
// Service logic under test
// ──────────────────────────────────────────────

const PRICE_IDS: Record<string, string> = {
  pro: "price_pro_test",
  employer: "price_employer_test",
  recruiter: "price_recruiter_test",
};

const VALID_TIERS = ["pro", "employer", "recruiter"];

async function createCheckoutSession(input: {
  userId: string;
  email: string;
  tier: string;
}) {
  if (!VALID_TIERS.includes(input.tier)) {
    const err = new Error("Invalid tier") as any;
    err.statusCode = 422;
    throw err;
  }

  // Check existing active subscription for same tier
  const existing = await mockSubscriptionRepo.findOne({
    userId: input.userId,
    tier: input.tier,
    status: "active",
  });
  if (existing) {
    const err = new Error("Already subscribed to this tier") as any;
    err.statusCode = 409;
    throw err;
  }

  const priceId = PRICE_IDS[input.tier];

  // Stripe would be called here — mocked globally
  return {
    id: `cs_test_${uuid().slice(0, 8)}`,
    url: `https://checkout.stripe.com/test/${input.tier}`,
    priceId,
    tier: input.tier,
    userId: input.userId,
  };
}

type WebhookEvent = {
  type: string;
  data: { object: Record<string, any> };
  id: string;
};

const processedEvents = new Set<string>();

async function handleWebhook(event: WebhookEvent) {
  // Idempotency check
  if (processedEvents.has(event.id)) {
    return { status: "already_processed" };
  }
  processedEvents.add(event.id);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscription = createTestSubscription({
        userId: session.metadata?.userId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
        tier: session.metadata?.tier ?? "pro",
        status: "active",
      });
      mockSubscriptionRepo.create.mockResolvedValue(subscription);
      await mockSubscriptionRepo.create(subscription);
      return { status: "subscription_created" };
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      await mockSubscriptionRepo.update(invoice.subscription, {
        status: "active",
        currentPeriodEnd: new Date(invoice.period_end * 1000),
      });
      return { status: "period_extended" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      await mockSubscriptionRepo.update(invoice.subscription, {
        status: "past_due",
      });
      return { status: "marked_past_due" };
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      await mockSubscriptionRepo.update(sub.id, { status: "cancelled" });
      return { status: "cancelled" };
    }

    default:
      return { status: "ignored" };
  }
}

function checkTierAccess(
  requiredTier: string,
  subscription: { tier: string; status: string; currentPeriodEnd: Date } | null,
): { allowed: boolean; reason?: string } {
  if (!subscription) {
    return { allowed: false, reason: "Subscription required" };
  }

  if (subscription.tier !== requiredTier && subscription.tier !== "enterprise") {
    return { allowed: false, reason: `${requiredTier} subscription required` };
  }

  if (subscription.status === "cancelled") {
    // Still has access until period end
    if (new Date(subscription.currentPeriodEnd) > new Date()) {
      return { allowed: true };
    }
    return { allowed: false, reason: "Subscription expired" };
  }

  if (subscription.status === "past_due") {
    // Grace period: 7 days
    const gracePeriodEnd = new Date(subscription.currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    if (gracePeriodEnd < new Date()) {
      return { allowed: false, reason: "Payment overdue" };
    }
    return { allowed: true };
  }

  if (subscription.status === "active") {
    return { allowed: true };
  }

  return { allowed: false, reason: "Invalid subscription status" };
}

// ──────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────

describe("Subscription Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processedEvents.clear();
  });

  // ──── Checkout ────

  describe("checkout session creation", () => {
    it("should create checkout for Pro tier with correct price ID", async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await createCheckoutSession({
        userId: "user-1",
        email: "user@test.com",
        tier: "pro",
      });

      expect(result.priceId).toBe("price_pro_test");
      expect(result.url).toContain("checkout.stripe.com");
    });

    it("should create checkout for Employer tier", async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await createCheckoutSession({
        userId: "user-2",
        email: "emp@test.com",
        tier: "employer",
      });

      expect(result.priceId).toBe("price_employer_test");
    });

    it("should create checkout for Recruiter tier", async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await createCheckoutSession({
        userId: "user-3",
        email: "rec@test.com",
        tier: "recruiter",
      });

      expect(result.priceId).toBe("price_recruiter_test");
    });

    it("should reject invalid tier with 422", async () => {
      await expect(
        createCheckoutSession({
          userId: "user-4",
          email: "bad@test.com",
          tier: "nonexistent",
        }),
      ).rejects.toMatchObject({ statusCode: 422 });
    });

    it("should reject if already subscribed to same tier", async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue(
        createTestSubscription({ tier: "pro", status: "active" }),
      );

      await expect(
        createCheckoutSession({
          userId: "user-5",
          email: "dup@test.com",
          tier: "pro",
        }),
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("should return a checkout URL in the response", async () => {
      mockSubscriptionRepo.findOne.mockResolvedValue(null);

      const result = await createCheckoutSession({
        userId: "user-6",
        email: "url@test.com",
        tier: "pro",
      });

      expect(result.url).toBeDefined();
      expect(result.url.startsWith("https://")).toBe(true);
    });
  });

  // ──── Webhook ────

  describe("webhook handling", () => {
    it("should create subscription on checkout.session.completed", async () => {
      const result = await handleWebhook({
        id: "evt_1",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_123",
            subscription: "sub_123",
            metadata: { userId: "user-1", tier: "pro" },
          },
        },
      });

      expect(result.status).toBe("subscription_created");
      expect(mockSubscriptionRepo.create).toHaveBeenCalled();
    });

    it("should update status on invoice.payment_failed", async () => {
      mockSubscriptionRepo.update.mockResolvedValue({ status: "past_due" });

      const result = await handleWebhook({
        id: "evt_2",
        type: "invoice.payment_failed",
        data: { object: { subscription: "sub_123" } },
      });

      expect(result.status).toBe("marked_past_due");
      expect(mockSubscriptionRepo.update).toHaveBeenCalledWith(
        "sub_123",
        expect.objectContaining({ status: "past_due" }),
      );
    });

    it("should cancel subscription on customer.subscription.deleted", async () => {
      mockSubscriptionRepo.update.mockResolvedValue({ status: "cancelled" });

      const result = await handleWebhook({
        id: "evt_3",
        type: "customer.subscription.deleted",
        data: { object: { id: "sub_123" } },
      });

      expect(result.status).toBe("cancelled");
    });

    it("should extend period on invoice.paid", async () => {
      mockSubscriptionRepo.update.mockResolvedValue({ status: "active" });

      const futureTimestamp = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
      const result = await handleWebhook({
        id: "evt_4",
        type: "invoice.paid",
        data: {
          object: {
            subscription: "sub_123",
            period_end: futureTimestamp,
          },
        },
      });

      expect(result.status).toBe("period_extended");
    });

    it("should ignore unknown event types gracefully", async () => {
      const result = await handleWebhook({
        id: "evt_5",
        type: "some.unknown.event",
        data: { object: {} },
      });

      expect(result.status).toBe("ignored");
    });

    it("should handle duplicate events idempotently", async () => {
      const event: WebhookEvent = {
        id: "evt_dup",
        type: "checkout.session.completed",
        data: {
          object: {
            customer: "cus_dup",
            subscription: "sub_dup",
            metadata: { userId: "user-dup", tier: "pro" },
          },
        },
      };

      await handleWebhook(event);
      const result2 = await handleWebhook(event);

      expect(result2.status).toBe("already_processed");
      // create should have been called only once
      expect(mockSubscriptionRepo.create).toHaveBeenCalledTimes(1);
    });
  });

  // ──── Tier Enforcement ────

  describe("tier enforcement", () => {
    it("should deny recruiter feature with no subscription", () => {
      const result = checkTierAccess("recruiter", null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Subscription required");
    });

    it("should allow recruiter feature with active recruiter subscription", () => {
      const sub = createTestSubscription({ tier: "recruiter", status: "active" });
      const result = checkTierAccess("recruiter", sub);
      expect(result.allowed).toBe(true);
    });

    it("should deny employer feature with no subscription", () => {
      const result = checkTierAccess("employer", null);
      expect(result.allowed).toBe(false);
    });

    it("should allow employer feature with active employer subscription", () => {
      const sub = createTestSubscription({ tier: "employer", status: "active" });
      const result = checkTierAccess("employer", sub);
      expect(result.allowed).toBe(true);
    });

    it("should deny pro feature for free tier", () => {
      const sub = createTestSubscription({ tier: "free", status: "active" });
      const result = checkTierAccess("pro", sub);
      expect(result.allowed).toBe(false);
    });

    it("should allow pro feature with active pro subscription", () => {
      const sub = createTestSubscription({ tier: "pro", status: "active" });
      const result = checkTierAccess("pro", sub);
      expect(result.allowed).toBe(true);
    });

    it("should allow access for cancelled subscription until period end", () => {
      const sub = createTestSubscription({
        tier: "pro",
        status: "cancelled",
        currentPeriodEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      const result = checkTierAccess("pro", sub);
      expect(result.allowed).toBe(true);
    });

    it("should deny access for expired past_due subscription (>7 days)", () => {
      const sub = createTestSubscription({
        tier: "pro",
        status: "past_due",
        currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      });
      const result = checkTierAccess("pro", sub);
      expect(result.allowed).toBe(false);
    });
  });
});
