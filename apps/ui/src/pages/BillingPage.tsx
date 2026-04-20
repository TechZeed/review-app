import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';
import type { components } from '../api-types';

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';

// ── Plan catalogue ────────────────────────────────────────────────────────
// No /api/v1/subscriptions/plans endpoint exists (see docs/api-contract.md
// — subscription module). The valid `tier` values are encoded in the
// checkout zod schema; we mirror them here with display metadata. Keep in
// sync with spec 11 §1.
type TierGroup = 'individual' | 'employer' | 'recruiter';
type BillingCycle = 'monthly' | 'annual';

interface Plan {
  tier:
    | 'pro_individual'
    | 'employer_small'
    | 'employer_medium'
    | 'employer_large'
    | 'recruiter_basic'
    | 'recruiter_premium';
  group: TierGroup;
  // The DB-side tier label that the API returns on /me (`pro`, `employer`,
  // `recruiter`). Used to determine current-plan / upgrade vs downgrade.
  dbTier: 'pro' | 'employer' | 'recruiter';
  name: string;
  price: string;
  cycle: BillingCycle;
  blurb: string;
  // Order within group — higher rank = more expensive plan.
  rank: number;
  // Whether the API requires a quantity hint (locationCount / seatCount).
  qtyKind?: 'locationCount' | 'seatCount';
}

const PLANS: Plan[] = [
  {
    tier: 'pro_individual',
    group: 'individual',
    dbTier: 'pro',
    name: 'Pro Individual — Monthly',
    price: '$10/month',
    cycle: 'monthly',
    blurb: 'Analytics, custom QR designs, video reel, recruiter visibility.',
    rank: 1,
  },
  {
    tier: 'pro_individual',
    group: 'individual',
    dbTier: 'pro',
    name: 'Pro Individual — Annual',
    price: '$5/month (billed yearly)',
    cycle: 'annual',
    blurb: 'Same as monthly, 50% off when paid yearly.',
    rank: 2,
  },
  {
    tier: 'employer_small',
    group: 'employer',
    dbTier: 'employer',
    name: 'Employer — Small',
    price: '$50/month per location',
    cycle: 'monthly',
    blurb: 'Up to 25 employees per location. Team dashboard + leaderboard.',
    rank: 1,
    qtyKind: 'locationCount',
  },
  {
    tier: 'employer_medium',
    group: 'employer',
    dbTier: 'employer',
    name: 'Employer — Medium',
    price: '$100/month per location',
    cycle: 'monthly',
    blurb: '25–100 employees. Adds retention risk alerts.',
    rank: 2,
    qtyKind: 'locationCount',
  },
  {
    tier: 'employer_large',
    group: 'employer',
    dbTier: 'employer',
    name: 'Employer — Large',
    price: '$200/month per location',
    cycle: 'monthly',
    blurb: '100+ employees. All employer features.',
    rank: 3,
    qtyKind: 'locationCount',
  },
  {
    tier: 'recruiter_basic',
    group: 'recruiter',
    dbTier: 'recruiter',
    name: 'Recruiter Basic',
    price: '$500/month per seat',
    cycle: 'monthly',
    blurb: 'Search + view reviewee profiles.',
    rank: 1,
    qtyKind: 'seatCount',
  },
  {
    tier: 'recruiter_premium',
    group: 'recruiter',
    dbTier: 'recruiter',
    name: 'Recruiter Premium',
    price: '$1,000/month per seat',
    cycle: 'monthly',
    blurb: 'Search + view + contact + verifiable references.',
    rank: 2,
    qtyKind: 'seatCount',
  },
];

// ── API types ─────────────────────────────────────────────────────────────
type Capability = components['schemas']['Capability'];
type SubscriptionMe = components['schemas']['SubscriptionMe'];

interface CheckoutResponse {
  checkoutSessionId?: string;
  checkoutUrl: string;
  expiresAt?: number;
}

interface PortalResponse {
  portalUrl: string;
}

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

// Spec 28 — no role-based plan filtering. Every user sees every plan group;
// the current-plan card lists all active capabilities from /subscriptions/me.
const GROUP_LABELS: Record<TierGroup, string> = {
  individual: 'Individual',
  employer: 'Employer',
  recruiter: 'Recruiter',
};

export default function BillingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pendingTier, setPendingTier] = useState<string | null>(null);

  if (!user) return <Navigate to="/login" replace />;

  const currentQuery = useQuery<SubscriptionMe>({
    queryKey: ['subscription', 'me'],
    queryFn: () => api<SubscriptionMe>('/api/v1/subscriptions/me', user.token),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (plan: Plan) => {
      setErrorMsg(null);
      setPendingTier(plan.tier + ':' + plan.cycle);
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
      // Redirect straight to Stripe-hosted Checkout — no Stripe.js needed.
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        setErrorMsg('Checkout session created but no redirect URL returned.');
        setPendingTier(null);
      }
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Checkout failed.');
      setPendingTier(null);
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const returnUrl = `${window.location.origin}/billing`;
      return api<PortalResponse>('/api/v1/subscriptions/portal', user.token, {
        method: 'POST',
        body: JSON.stringify({ returnUrl }),
      });
    },
    onSuccess: (data) => {
      if (data.portalUrl) {
        window.location.assign(data.portalUrl);
      } else {
        setErrorMsg('Portal session created but no redirect URL returned.');
        setPendingTier(null);
      }
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : 'Portal redirect failed.');
      setPendingTier(null);
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

  const current = currentQuery.data;
  const hasActive =
    !!current && (current.status === 'active' || current.status === 'trialing');

  // Find current plan in our catalogue (best-effort: match dbTier + cycle).
  const currentPlan = hasActive
    ? PLANS.find(
        (p) =>
          p.dbTier === current?.tier &&
          (current?.billingCycle ? p.cycle === current.billingCycle : true),
      )
    : undefined;

  const activeCapabilities: Capability[] = current?.capabilities ?? [];

  function ctaFor(plan: Plan): { label: string; variant: 'primary' | 'secondary' | 'danger' } {
    if (!hasActive) return { label: 'Subscribe', variant: 'primary' };
    if (currentPlan?.tier === plan.tier && currentPlan?.cycle === plan.cycle) {
      return { label: 'Current plan', variant: 'secondary' };
    }
    // Spec 51: active subscribers switch plans via Stripe Billing Portal,
    // so every non-current plan uses a single "Switch plan" CTA.
    return { label: 'Switch plan', variant: 'secondary' };
  }

  return (
    <div className="min-h-screen bg-gray-50" data-testid="billing-root">
      <NavBar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <header>
          <h1 className="text-2xl font-bold text-gray-900">Billing &amp; plans</h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your ReviewApp subscription. Payments are processed by Stripe.
          </p>
        </header>

        {errorMsg && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700"
            data-testid="billing-error"
          >
            {errorMsg}
          </div>
        )}

        {/* Current plan card */}
        <section
          className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
          data-testid="billing-current-plan"
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Current plan
          </h2>
          {currentQuery.isLoading ? (
            <p className="text-gray-400">Loading subscription…</p>
          ) : currentQuery.error ? (
            <p className="text-red-600 text-sm">
              Could not load subscription:{' '}
              {currentQuery.error instanceof Error
                ? currentQuery.error.message
                : 'unknown error'}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="text-2xl font-bold text-gray-900 capitalize">
                    {current?.tier ?? 'free'}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Status: <span data-testid="billing-status">{current?.status ?? 'none'}</span>
                    {current?.currentPeriodEnd && (
                      <>
                        {' '}
                        · renews{' '}
                        {new Date(current.currentPeriodEnd).toLocaleDateString()}
                      </>
                    )}
                    {current?.cancelAtPeriodEnd && (
                      <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">
                        cancels at period end
                      </span>
                    )}
                  </div>
                </div>
                {hasActive && !current?.cancelAtPeriodEnd && (
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate()}
                    disabled={cancelMutation.isPending}
                    className="text-sm text-red-700 hover:text-red-900 px-3 py-1.5 rounded-md border border-red-300 hover:bg-red-50 disabled:opacity-50"
                    data-testid="billing-cancel-btn"
                  >
                    {cancelMutation.isPending ? 'Cancelling…' : 'Cancel subscription'}
                  </button>
                )}
              </div>

              {/* Spec 28 — list every active capability. A single user may
                  hold pro + employer + recruiter concurrently. */}
              <div data-testid="billing-active-capabilities">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Active capabilities
                </h3>
                {activeCapabilities.length === 0 ? (
                  <p className="text-sm text-gray-500">
                    No active paid capabilities. Subscribe below to unlock features.
                  </p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {activeCapabilities.map((c) => (
                      <li
                        key={c.capability}
                        data-testid="billing-active-capability"
                        data-capability={c.capability}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-sm text-green-800"
                      >
                        <span className="capitalize font-medium">{c.capability}</span>
                        <span className="text-xs text-green-700">
                          · {c.source === 'admin-grant' ? 'admin grant' : 'subscription'}
                          {c.expiresAt && (
                            <> · expires {new Date(c.expiresAt).toLocaleDateString()}</>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Spec 28 — show every plan group. Capability unlocks the feature,
            regardless of the user's primary role. */}
        {(['individual', 'employer', 'recruiter'] as TierGroup[]).map((grp) => {
          const groupPlans = PLANS.filter((p) => p.group === grp);
          return (
            <section key={grp} data-testid={`billing-group-${grp}`}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                {GROUP_LABELS[grp]} plans
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groupPlans.map((plan) => {
                  const cta = ctaFor(plan);
                  const key = plan.tier + ':' + plan.cycle;
                  const isPending = pendingTier === key && (checkoutMutation.isPending || portalMutation.isPending);
                  const isCurrent = cta.label === 'Current plan';
                  return (
                    <div
                      key={key}
                      className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col"
                      data-testid="billing-plan-card"
                      data-plan-tier={plan.tier}
                      data-plan-cycle={plan.cycle}
                    >
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">{plan.name}</h3>
                        <p className="text-lg font-bold text-gray-900 mt-1">{plan.price}</p>
                        <p className="text-sm text-gray-600 mt-2">{plan.blurb}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPendingTier(key);
                          if (hasActive) {
                            portalMutation.mutate();
                            return;
                          }
                          checkoutMutation.mutate(plan);
                        }}
                        disabled={isPending || isCurrent}
                        className={
                          'mt-4 px-4 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ' +
                          (cta.variant === 'primary'
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : cta.variant === 'danger'
                              ? 'bg-red-600 text-white hover:bg-red-700'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                        }
                        data-testid="billing-upgrade-btn"
                      >
                        {isPending ? 'Redirecting to Stripe…' : cta.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
        <p className="text-xs text-gray-500">
          Test mode — use card 4242 4242 4242 4242, any future expiry, any CVC.
        </p>
      </main>
    </div>
  );
}
