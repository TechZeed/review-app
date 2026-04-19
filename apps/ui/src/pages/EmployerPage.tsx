import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

// Spec 13 — Employer dashboard. Allowed roles: EMPLOYER, ADMIN.
// API surface used (see docs/api-contract.md):
//   GET /api/v1/employer/dashboard       — org metrics
//   GET /api/v1/employer/team            — team list
//   GET /api/v1/employer/team/retention  — retention signals (for inbox-style alerts)
//
// API GAPS (logged here, intentionally NOT invented):
//   • No "verifiable references inbox for my org" endpoint exists. The
//     reference flow today is recruiter-driven (POST /references/request) and
//     SMS-relayed; the employer cannot approve/decline references via the API.
//     We render the inbox tab as a "coming soon" panel and surface retention
//     alerts (closest available signal) so the tab is useful, not empty.

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';

type Tab = 'references' | 'team' | 'org';

interface DashboardResponse {
  organizationId?: string;
  organizationName?: string;
  teamSize?: number;
  totalReviews?: number;
  avgReviewsPerMember?: number;
  aggregateQualityBreakdown?: Record<string, number>;
  topPerformers?: Array<{ profileId: string; name: string; reviewCount: number; compositeScore: number; dominantQuality?: string }>;
  reviewVelocity?: { current: number; previous: number; changePercent: number };
}

interface TeamMember {
  profileId: string;
  name: string;
  roleTitle?: string | null;
  totalReviews?: number;
  compositeScore?: number;
  dominantQuality?: string | null;
}

interface TeamResponse {
  members?: TeamMember[];
  team?: TeamMember[];
  data?: TeamMember[];
  page?: number;
  total?: number;
}

interface RetentionAlert {
  profileId: string;
  name: string;
  signal?: string;
  detail?: string;
  dropPercent?: number;
}

interface RetentionResponse {
  alerts?: RetentionAlert[];
  retentionAlerts?: RetentionAlert[];
}

async function api<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function pickMembers(t: TeamResponse | undefined): TeamMember[] {
  if (!t) return [];
  return t.members ?? t.team ?? t.data ?? [];
}

function pickAlerts(r: RetentionResponse | undefined): RetentionAlert[] {
  if (!r) return [];
  return r.alerts ?? r.retentionAlerts ?? [];
}

export default function EmployerPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Spec 28 — capability gate. ADMIN bypasses. Missing cap → /billing (intent:
  // "here's how to get access") rather than /dashboard (silent dead end).
  if (!user.capabilities?.includes('employer') && user.role !== 'ADMIN') return <Navigate to="/billing" replace />;

  const [tab, setTab] = useState<Tab>('references');

  const dashboard = useQuery({
    queryKey: ['employer', 'dashboard'],
    queryFn: () => api<DashboardResponse>('/api/v1/employer/dashboard', user.token),
  });

  const team = useQuery({
    queryKey: ['employer', 'team'],
    queryFn: () => api<TeamResponse>('/api/v1/employer/team?limit=50', user.token),
    enabled: tab === 'team',
  });

  const retention = useQuery({
    queryKey: ['employer', 'retention'],
    queryFn: () => api<RetentionResponse>('/api/v1/employer/team/retention', user.token),
    enabled: tab === 'references',
  });

  const tabBtn = (id: Tab, testid: string, label: string) => (
    <button
      data-testid={testid}
      onClick={() => setTab(id)}
      className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
        tab === id ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="employer-root">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Employer dashboard</h1>
            {dashboard.data?.organizationName && (
              <p className="text-sm text-gray-600 mt-1">{dashboard.data.organizationName}</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {tabBtn('references', 'employer-tab-references', 'References inbox')}
          {tabBtn('team', 'employer-tab-team', 'Team reviews')}
          {tabBtn('org', 'employer-tab-org', 'Organization')}
        </div>

        {tab === 'references' && (
          <section data-testid="employer-references">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-amber-900 font-medium">References inbox — preview</p>
              <p className="text-sm text-amber-800 mt-1">
                Employer-side approve/decline of verifiable references is not yet exposed by the API
                (spec 13 §16 covers the recruiter flow; the employer inbox endpoint is pending). Until
                then, this tab surfaces team retention signals — the closest live data — so you can act
                on members whose review velocity has dropped.
              </p>
            </div>

            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Retention signals
            </h2>

            {retention.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {retention.error && (
              <p className="text-sm text-red-600">Failed to load retention signals.</p>
            )}
            {retention.data && pickAlerts(retention.data).length === 0 && (
              <p className="text-sm text-gray-500">No retention alerts. Team velocity looks healthy.</p>
            )}

            <ul className="space-y-3">
              {pickAlerts(retention.data).map((a) => (
                <li
                  key={a.profileId}
                  data-testid="employer-reference-row"
                  className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{a.name}</p>
                    <p className="text-sm text-gray-600">
                      {a.detail ?? a.signal ?? 'velocity_drop'}
                      {typeof a.dropPercent === 'number' && (
                        <span className="text-gray-400"> · {a.dropPercent.toFixed(0)}% drop</span>
                      )}
                    </p>
                  </div>
                  {/* Approve/decline buttons stubbed until the API exists.
                      Disabled, but rendered so the testid map is stable. */}
                  <div className="flex gap-2 shrink-0">
                    <button
                      data-testid="employer-approve-ref-btn"
                      disabled
                      title="Pending API"
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
                    >
                      Approve
                    </button>
                    <button
                      data-testid="employer-decline-ref-btn"
                      disabled
                      title="Pending API"
                      className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium opacity-50 cursor-not-allowed"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {tab === 'team' && (
          <section data-testid="employer-team">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Team members
            </h2>
            {team.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {team.error && <p className="text-sm text-red-600">Failed to load team.</p>}
            {team.data && pickMembers(team.data).length === 0 && (
              <p className="text-sm text-gray-500">No consented team members yet.</p>
            )}
            {team.data && pickMembers(team.data).length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-2">Name</th>
                      <th className="px-4 py-2">Role</th>
                      <th className="px-4 py-2">Reviews</th>
                      <th className="px-4 py-2">Composite</th>
                      <th className="px-4 py-2">Top quality</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickMembers(team.data).map((m) => (
                      <tr
                        key={m.profileId}
                        data-testid="employer-team-review-row"
                        className="border-t border-gray-100"
                      >
                        <td className="px-4 py-2 text-gray-900">{m.name}</td>
                        <td className="px-4 py-2 text-gray-600">{m.roleTitle ?? '—'}</td>
                        <td className="px-4 py-2">{m.totalReviews ?? 0}</td>
                        <td className="px-4 py-2">
                          {typeof m.compositeScore === 'number' ? m.compositeScore.toFixed(2) : '—'}
                        </td>
                        <td className="px-4 py-2 text-gray-500">{m.dominantQuality ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'org' && (
          <section data-testid="employer-org">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
              Organization snapshot
            </h2>
            {dashboard.isLoading && <p className="text-sm text-gray-500">Loading…</p>}
            {dashboard.error && <p className="text-sm text-red-600">Failed to load dashboard.</p>}
            {dashboard.data && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Stat label="Team size" value={dashboard.data.teamSize ?? 0} />
                <Stat label="Total reviews" value={dashboard.data.totalReviews ?? 0} />
                <Stat
                  label="Avg / member"
                  value={
                    typeof dashboard.data.avgReviewsPerMember === 'number'
                      ? dashboard.data.avgReviewsPerMember.toFixed(1)
                      : '—'
                  }
                />
                <Stat
                  label="Velocity Δ"
                  value={
                    dashboard.data.reviewVelocity
                      ? `${dashboard.data.reviewVelocity.changePercent.toFixed(0)}%`
                      : '—'
                  }
                />
              </div>
            )}

            {dashboard.data?.aggregateQualityBreakdown && (
              <div className="mt-6 bg-white rounded-lg border border-gray-200 p-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Quality breakdown</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {Object.entries(dashboard.data.aggregateQualityBreakdown).map(([q, v]) => (
                    <li key={q} className="text-center">
                      <p className="text-xs uppercase text-gray-500">{q}</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {typeof v === 'number' ? v.toFixed(1) : String(v)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {dashboard.data?.topPerformers && dashboard.data.topPerformers.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Top performers</h3>
                <ul className="space-y-2">
                  {dashboard.data.topPerformers.map((p) => (
                    <li
                      key={p.profileId}
                      className="bg-white rounded-lg border border-gray-200 p-3 flex justify-between text-sm"
                    >
                      <span className="font-medium text-gray-900">{p.name}</span>
                      <span className="text-gray-600">
                        {p.reviewCount} reviews · {p.compositeScore.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs uppercase text-gray-500">{label}</p>
      <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
    </div>
  );
}
