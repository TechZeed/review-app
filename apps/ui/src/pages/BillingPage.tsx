import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';
import type { components } from '../api-types';

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';

type TierGroup = 'individual' | 'employer' | 'recruiter';
type BillingCycle = 'monthly' | 'annual';

type Plan = {
  tier:
    | 'pro_individual'
    | 'employer_small'
    | 'employer_medium'
    | 'employer_large'
    | 'recruiter_basic'
    | 'recruiter_premium';
  group: TierGroup;
  cycle: BillingCycle;
  label: string;
  price: string;
  qtyKind?: 'locationCount' | 'seatCount';
};

const PLANS: Plan[] = [
  { tier: 'pro_individual', group: 'individual', cycle: 'monthly', label: 'Monthly', price: '$10/month' },
  { tier: 'pro_individual', group: 'individual', cycle: 'annual', label: 'Annual', price: '$5/month (billed yearly)' },
  { tier: 'employer_small', group: 'employer', cycle: 'monthly', label: 'Small', price: '$50/month per location', qtyKind: 'locationCount' },
  { tier: 'employer_medium', group: 'employer', cycle: 'monthly', label: 'Medium', price: '$100/month per location', qtyKind: 'locationCount' },
  { tier: 'employer_large', group: 'employer', cycle: 'monthly', label: 'Large', price: '$200/month per location', qtyKind: 'locationCount' },
  { tier: 'recruiter_basic', group: 'recruiter', cycle: 'monthly', label: 'Basic', price: '$500/month per seat', qtyKind: 'seatCount' },
  { tier: 'recruiter_premium', group: 'recruiter', cycle: 'monthly', label: 'Premium', price: '$1,000/month per seat', qtyKind: 'seatCount' },
];

type Capability = components['schemas']['Capability'];
type SubscriptionMe = components['schemas']['SubscriptionMe'];

type CheckoutResponse = {
  checkoutSessionId?: string;
  checkoutUrl: string;
  expiresAt?: number;
};

const CAPABILITY_TO_GROUP: Record<string, TierGroup | undefined> = {
  pro: 'individual',
  employer: 'employer',
  recruiter: 'recruiter',
};

const GROUP_TO_CAPABILITY: Record<TierGroup, string> = {
  individual: 'pro',
  employer: 'employer',
  recruiter: 'recruiter',
};

const GROUP_LABEL: Record<TierGroup, string> = {
  individual: 'Pro Individual',
  employer: 'Company',
  recruiter: 'Recruiter',
};

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

export default function BillingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<TierGroup | null>(null);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;

  const meQuery = useQuery<SubscriptionMe>({
    queryKey: ['subscription', 'me'],
    queryFn: () => api<SubscriptionMe>('/api/v1/subscriptions/me', user.token),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      setErrorMsg(null);
      setPendingPlan(`${plan.tier}:${plan.cycle}`);
      const successUrl = `${window.location.origin}/billing?status=success`;
      const cancelUrl = `${window.location.origin}/billing?status=cancelled`;
      const body: Record<string, unknown> = {
        tier: plan.tier,
        billingCycle: plan.cycle,
        successUrl,
        cancelUrl,
      };
      if (plan.qtyKind === 'locationCount') body.locationCount = 1;
      if (plan.qtyKind === 'seatCount') body.seatCount = 1;
      return api<CheckoutResponse>('/api/v1/subscriptions/checkout', user.token, {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setErrorMsg('Checkout session created but no redirect URL returned.');
        setPendingPlan(null);
      }
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed.');
      setPendingPlan(null);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      return api<{ cancelled: boolean }>('/api/v1/subscriptions/cancel', user.token, {
        method: 'POST',
        body: JSON.stringify({ immediate: false }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', 'me'] });
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Cancel failed.');
    },
  });

  const capabilities: Capability[] = meQuery.data?.capabilities ?? [];
  const activeGroups = new Set(
    capabilities
      .map((cap) => CAPABILITY_TO_GROUP[cap.capability])
      .filter((group): group is TierGroup => Boolean(group)),
  );

  const hasActiveSub = meQuery.data?.status === 'active' || meQuery.data?.status === 'trialing';
  const showSyncWarning = meQuery.data?.reconciliation?.consistent === false;

  const pathways: Array<{ group: TierGroup; title: string; blurb: string }> = [
    {
      group: 'individual',
      title: 'Become a Pro Individual',
      blurb: 'Grow your personal brand with premium review visibility and profile upgrades.',
    },
    {
      group: 'employer',
      title: 'Become a Company',
      blurb: 'Give your team reputation analytics and improve frontline retention outcomes.',
    },
    {
      group: 'recruiter',
      title: 'Become a Recruiter',
      blurb: 'Find strong candidates faster with trusted review-backed hiring signals.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50" data-testid="billing-root">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; plans</h1>
          <p className="text-sm text-gray-600 mt-1">Manage your subscription and choose the role pathway you need.</p>
        </header>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700" data-testid="billing-error">
            {errorMsg}
          </div>
        )}

        {showSyncWarning && (
          <div
            data-testid="billing-reconciliation-warning"
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm text-yellow-800"
          >
            Your subscription is syncing — refresh in a moment.
          </div>
        )}

        <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm" data-testid="billing-you-are">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">You are</h2>
          {meQuery.isLoading ? (
            <p className="text-gray-500">Loading capabilities…</p>
          ) : meQuery.isError ? (
            <p className="text-sm text-red-600">
              Could not load subscription: {meQuery.error instanceof Error ? meQuery.error.message : 'unknown error'}
            </p>
          ) : capabilities.length === 0 ? (
            <p className="text-sm text-gray-600">Free user (no active paid capabilities)</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {Array.from(activeGroups).map((group) => (
                <li
                  key={group}
                  className="inline-flex items-center px-3 py-1 rounded-full bg-green-50 border border-green-200 text-sm text-green-800"
                >
                  {GROUP_LABEL[group]}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-4">
          {pathways.map((pathway) => {
            const owned = activeGroups.has(pathway.group);
            const expanded = expandedGroup === pathway.group;
            const plans = PLANS.filter((plan) => plan.group === pathway.group);
            const pathwayTestId = `billing-pathway-${pathway.group}`;
            const expandTestId = `billing-pathway-${pathway.group}-expand`;
            const canCancel = owned && hasActiveSub && !meQuery.data?.cancelAtPeriodEnd;

            return (
              <article
                key={pathway.group}
                data-testid={pathwayTestId}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {owned ? `You're a ${GROUP_LABEL[pathway.group]}` : pathway.title}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">{pathway.blurb}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setExpandedGroup(expanded ? null : pathway.group)}
                      className="px-3 py-1.5 rounded-md text-sm font-medium bg-blue-600 text-white hover:bg-blue-700"
                    >
                      {owned ? 'Change plan' : 'Choose plan'}
                    </button>
                    {owned && (
                      <button
                        type="button"
                        onClick={() => cancelMutation.mutate()}
                        disabled={!canCancel || cancelMutation.isPending}
                        className="px-3 py-1.5 rounded-md text-sm font-medium border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {cancelMutation.isPending ? 'Cancelling…' : 'Cancel'}
                      </button>
                    )}
                  </div>
                </div>

                {expanded && (
                  <div data-testid={expandTestId} className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {plans.map((plan) => {
                      const pendingKey = `${plan.tier}:${plan.cycle}`;
                      const isPending = checkoutMutation.isPending && pendingPlan === pendingKey;
                      return (
                        <button
                          key={pendingKey}
                          type="button"
                          onClick={() => checkoutMutation.mutate(plan)}
                          disabled={isPending}
                          className="text-left p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 disabled:opacity-50"
                        >
                          <div className="text-sm font-semibold text-gray-900">{plan.label}</div>
                          <div className="text-sm text-gray-700">{plan.price}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {isPending ? 'Redirecting to Stripe…' : owned ? 'Change to this plan' : 'Start this plan'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}
