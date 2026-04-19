import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';

const API_URL = import.meta.env.VITE_API_URL || 'https://review-api.teczeed.com';

const QUALITY_OPTIONS = ['expertise', 'care', 'delivery', 'initiative', 'trust'] as const;
type Quality = (typeof QUALITY_OPTIONS)[number];

const INDUSTRY_OPTIONS = [
  '',
  'Auto Sales',
  'Hospitality',
  'Banking',
  'Healthcare',
  'Retail',
  'Technology',
  'Education',
];

interface QualityBreakdown {
  expertise: number;
  care: number;
  delivery: number;
  initiative: number;
  trust: number;
}

interface SearchResult {
  profileId: string;
  slug: string;
  displayName: string;
  avatarUrl: string | null;
  industry: string | null;
  location: string | null;
  headline: string | null;
  totalReviews: number;
  qualityBreakdown: QualityBreakdown;
  hasVideo: boolean;
  verifiedRate: number;
  recentCount?: number;
  compositeScore: number;
  isPro: boolean;
}

interface SearchResponse {
  results: SearchResult[];
  nextCursor: string | null;
  hasMore: boolean;
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function topQualities(b: QualityBreakdown): Array<{ q: Quality; n: number }> {
  return (Object.entries(b) as Array<[Quality, number]>)
    .map(([q, n]) => ({ q, n: Number(n) || 0 }))
    .sort((a, b) => b.n - a.n)
    .filter((x) => x.n > 0)
    .slice(0, 2);
}

export default function RecruiterPage() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Spec 28 — capability gate. ADMIN bypasses. Missing cap → /billing.
  if (!user.capabilities?.includes('recruiter') && user.role !== 'ADMIN') return <Navigate to="/billing" replace />;

  const [queryInput, setQueryInput] = useState('');
  const debouncedQuery = useDebounced(queryInput, 300);
  const [selectedQualities, setSelectedQualities] = useState<Set<Quality>>(new Set());
  const [industry, setIndustry] = useState<string>('');
  const [minReviewCount, setMinReviewCount] = useState<number>(0);
  const [contactFor, setContactFor] = useState<SearchResult | null>(null);

  const body = useMemo(() => {
    const b: Record<string, unknown> = { limit: 20 };
    const q = debouncedQuery.trim();
    if (q) b.query = q;
    if (industry) b.industries = [industry];
    if (selectedQualities.size > 0) {
      b.qualities = Array.from(selectedQualities).map((q) => ({ quality: q, minPercentage: 10 }));
    }
    if (minReviewCount > 0) b.minReviewCount = minReviewCount;
    return b;
  }, [debouncedQuery, industry, selectedQualities, minReviewCount]);

  const search = useQuery({
    queryKey: ['recruiter', 'search', body],
    queryFn: () =>
      api<SearchResponse>('/api/v1/recruiter/search', user.token, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  });

  const toggleQuality = (q: Quality) => {
    setSelectedQualities((prev) => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q);
      else next.add(q);
      return next;
    });
  };

  const results = search.data?.results ?? [];

  return (
    <div className="min-h-screen bg-gray-50" data-testid="recruiter-root">
      <NavBar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Recruiter search</h1>
        <p className="text-gray-600 mb-6">Find individuals by quality, industry, or keyword.</p>

        <div className="mb-6">
          <input
            type="search"
            data-testid="recruiter-search-input"
            placeholder="Search by name, headline, industry, location…"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <aside className="lg:col-span-1 bg-white rounded-lg border border-gray-200 p-4 h-fit">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Filters</h2>

            <div className="mb-4">
              <p className="text-xs uppercase font-medium text-gray-500 mb-2">Qualities</p>
              <div className="flex flex-col gap-1.5">
                {QUALITY_OPTIONS.map((q) => (
                  <label key={q} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      data-testid={`recruiter-filter-quality-${q}`}
                      checked={selectedQualities.has(q)}
                      onChange={() => toggleQuality(q)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="capitalize">{q}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs uppercase font-medium text-gray-500 mb-2">Industry</label>
              <select
                data-testid="recruiter-filter-industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt || 'Any industry'}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-2">
              <label className="block text-xs uppercase font-medium text-gray-500 mb-2">Min reviews</label>
              <input
                type="number"
                min={0}
                value={minReviewCount}
                onChange={(e) => setMinReviewCount(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-2 py-1.5 rounded-md border border-gray-300 bg-white text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          </aside>

          <section className="lg:col-span-3" data-testid="recruiter-results">
            {search.isLoading && <p className="text-sm text-gray-500">Searching…</p>}
            {search.error && (
              <p className="text-sm text-red-600" data-testid="recruiter-error">
                Search failed. Please try again.
              </p>
            )}
            {!search.isLoading && !search.error && results.length === 0 && (
              <div
                data-testid="recruiter-empty"
                className="bg-white rounded-lg border border-dashed border-gray-300 p-8 text-center"
              >
                <p className="text-gray-700 font-medium">No matching candidates</p>
                <p className="text-sm text-gray-500 mt-1">
                  Try a different keyword or relax your filters.
                </p>
              </div>
            )}

            <ul className="space-y-3">
              {results.map((r) => {
                const tops = topQualities(r.qualityBreakdown);
                return (
                  <li
                    key={r.profileId}
                    data-testid="recruiter-result-row"
                    className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col md:flex-row md:items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 truncate">{r.displayName}</p>
                        {r.isPro && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">
                            PRO
                          </span>
                        )}
                        <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{r.slug}</code>
                      </div>
                      {r.headline && (
                        <p className="text-sm text-gray-600 mt-0.5 truncate">{r.headline}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {r.industry ?? 'Unknown industry'}
                        {r.location ? ` · ${r.location}` : ''} · {r.totalReviews} reviews
                      </p>
                      {tops.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {tops.map(({ q, n }) => (
                            <span
                              key={q}
                              className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize"
                            >
                              {q} · {n}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      <button
                        data-testid="recruiter-contact-btn"
                        onClick={() => setContactFor(r)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700"
                      >
                        Contact
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {contactFor && (
          <ContactDialog
            token={user.token}
            target={contactFor}
            onClose={() => setContactFor(null)}
          />
        )}
      </main>
    </div>
  );
}

function ContactDialog({
  token,
  target,
  onClose,
}: {
  token: string;
  target: SearchResult;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState(`Opportunity for ${target.displayName}`);
  const [hiringRole, setHiringRole] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [message, setMessage] = useState('');

  const submit = useMutation({
    mutationFn: () =>
      api<{ id: string }>(`/api/v1/recruiter/contact/${target.profileId}`, token, {
        method: 'POST',
        body: JSON.stringify({ subject, hiringRole, companyName, message }),
      }),
    onSuccess: () => onClose(),
  });

  return (
    <div
      data-testid="recruiter-contact-dialog"
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact {target.displayName}</h3>
        <div className="space-y-3">
          <input
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
          />
          <input
            placeholder="Hiring role"
            value={hiringRole}
            onChange={(e) => setHiringRole(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
          />
          <input
            placeholder="Company name"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
          />
          <textarea
            placeholder="Message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm"
          />
          {submit.error && (
            <p className="text-sm text-red-600">Failed to send. Check fields and try again.</p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onClose}
            className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            data-testid="recruiter-contact-submit"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || !hiringRole || !companyName || !message}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {submit.isPending ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </div>
    </div>
  );
}
