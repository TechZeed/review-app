import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SubscriptionService } from '../../src/modules/subscription/subscription.service.js';

const { mockCapabilityRepo } = vi.hoisted(() => ({
  mockCapabilityRepo: {
    listActive: vi.fn(),
    upsert: vi.fn(),
  },
}));

vi.mock('../../src/modules/capability/capability.repo.js', () => ({
  capabilityRepo: mockCapabilityRepo,
}));

describe('SubscriptionService.getMySubscription reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns consistent=true when active tier and capability already match', async () => {
    const repo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'recruiter',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: 'stripe-sub-1',
        stripePriceId: null,
        billingCycle: 'monthly',
        quantity: 1,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-02-01T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    };
    mockCapabilityRepo.listActive.mockResolvedValue([
      { capability: 'recruiter', source: 'subscription', expiresAt: null },
    ]);

    const service = new SubscriptionService(repo as any);
    const me = await service.getMySubscription('user-1');

    expect(me.reconciliation).toEqual({ consistent: true, issues: [] });
    expect(mockCapabilityRepo.upsert).not.toHaveBeenCalled();
  });

  it('self-heals tier-without-capability by inserting missing subscription capability', async () => {
    const repo = {
      findByUserId: vi.fn().mockResolvedValue({
        id: 'sub-2',
        userId: 'user-2',
        tier: 'recruiter',
        status: 'active',
        stripeCustomerId: null,
        stripeSubscriptionId: 'stripe-sub-2',
        stripePriceId: null,
        billingCycle: 'monthly',
        quantity: 1,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        currentPeriodStart: new Date('2026-01-01T00:00:00.000Z'),
        currentPeriodEnd: new Date('2026-02-15T00:00:00.000Z'),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
    };
    mockCapabilityRepo.listActive
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ capability: 'recruiter', source: 'subscription', expiresAt: null }]);

    const service = new SubscriptionService(repo as any);
    const me = await service.getMySubscription('user-2');

    expect(mockCapabilityRepo.upsert).toHaveBeenCalledWith({
      userId: 'user-2',
      capability: 'recruiter',
      source: 'subscription',
      subscriptionId: 'sub-2',
      expiresAt: new Date('2026-02-15T00:00:00.000Z'),
      metadata: { self_healed: true },
    });
    expect(me.reconciliation).toEqual({
      consistent: false,
      issues: ['tier-without-capability'],
    });
    expect(me.capabilities?.map((c) => c.capability)).toContain('recruiter');
  });

  it('flags orphan-capability when multiple capabilities exist without a matching active subscription', async () => {
    const repo = {
      findByUserId: vi.fn().mockResolvedValue(null),
    };
    mockCapabilityRepo.listActive.mockResolvedValue([
      { capability: 'pro', source: 'admin-grant', expiresAt: null },
      { capability: 'recruiter', source: 'admin-grant', expiresAt: null },
    ]);

    const service = new SubscriptionService(repo as any);
    const me = await service.getMySubscription('user-3');

    expect(me.reconciliation.consistent).toBe(false);
    expect(me.reconciliation.issues).toContain('orphan-capability');
    expect(mockCapabilityRepo.upsert).not.toHaveBeenCalled();
  });
});
