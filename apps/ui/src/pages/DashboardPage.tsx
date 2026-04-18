import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';
import ProfileCard from '../components/ProfileCard';
import QualityHeatMap from '../components/QualityHeatMap';
import type { QualityBar } from '../components/QualityHeatMap';
import ReviewCard from '../components/ReviewCard';
import { fetchMyProfile, fetchReviews, fetchQualities } from '../lib/api';
import type { Profile, Review } from '../lib/api';

const QUALITY_ORDER: Array<{
  key: keyof NonNullable<Profile['qualityBreakdown']>;
  name: string;
  color: string;
}> = [
  { key: 'expertise', name: 'Expertise', color: '#3B82F6' },
  { key: 'care', name: 'Care', color: '#EC4899' },
  { key: 'delivery', name: 'Delivery', color: '#22C55E' },
  { key: 'initiative', name: 'Initiative', color: '#F97316' },
  { key: 'trust', name: 'Trust', color: '#8B5CF6' },
];

function buildQualityBarsFromProfile(profile: Profile | undefined): QualityBar[] {
  const breakdown = profile?.qualityBreakdown;
  return QUALITY_ORDER.map(({ key, name, color }) => ({
    name,
    percentage: breakdown && typeof breakdown[key] === 'number' ? breakdown[key] : 0,
    color,
  }));
}

export default function DashboardPage() {
  const { user } = useAuth();

  const profileQuery = useQuery<Profile>({
    queryKey: ['profile', 'me'],
    queryFn: () => fetchMyProfile(user!.token),
    enabled: !!user,
  });

  const qualitiesQuery = useQuery({
    queryKey: ['qualities'],
    queryFn: fetchQualities,
  });

  const reviewsQuery = useQuery({
    queryKey: ['profile', 'me', 'reviews'],
    queryFn: () =>
      profileQuery.data
        ? fetchReviews(profileQuery.data.id)
        : Promise.resolve({
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
    enabled: !!profileQuery.data,
  });

  const profile = profileQuery.data;
  const reviews = reviewsQuery.data?.reviews || [];

  const qualityBars: QualityBar[] = buildQualityBarsFromProfile(profile);

  const isLoading =
    profileQuery.isLoading || qualitiesQuery.isLoading;

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard-root">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-gray-400 text-lg">Loading dashboard...</div>
          </div>
        ) : profileQuery.error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700">
              Failed to load profile. Make sure the API server is running.
            </p>
            <p className="text-red-500 text-sm mt-2">
              {profileQuery.error instanceof Error
                ? profileQuery.error.message
                : 'Unknown error'}
            </p>
          </div>
        ) : profile ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Profile + QR */}
            <div className="lg:col-span-1 space-y-6">
              <ProfileCard profile={profile} showQR />
            </div>

            {/* Right column: Quality heat map + reviews */}
            <div className="lg:col-span-2 space-y-6">
              <QualityHeatMap
                qualities={qualityBars}
                interactive
                onQualityClick={(name) =>
                  console.log('Filter by quality:', name)
                }
              />

              {/* Stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                  label="Total Reviews"
                  value={profile.reviewCount}
                />
                <StatCard
                  label="This Month"
                  value={countThisMonth(reviews)}
                />
                <StatCard
                  label="Quality Score"
                  value={
                    qualityBars.length > 0
                      ? `${Math.round(
                          qualityBars.reduce(
                            (sum, q) => sum + q.percentage,
                            0,
                          ) / qualityBars.length,
                        )}%`
                      : '--'
                  }
                />
              </div>

              {/* Reviews list */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
                  Recent Reviews
                </h3>
                {reviews.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
                    No reviews yet. Share your QR code to start collecting
                    reviews.
                  </div>
                ) : (
                  <div
                    className="space-y-3"
                    role="feed"
                    aria-label="Recent reviews"
                  >
                    {reviews.map((review) => (
                      <ReviewCard key={review.id} review={review} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function countThisMonth(reviews: Review[]): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return reviews.filter((r) => {
    if (!r.createdAt) return false;
    const d = new Date(r.createdAt);
    if (Number.isNaN(d.getTime())) return false;
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;
}
