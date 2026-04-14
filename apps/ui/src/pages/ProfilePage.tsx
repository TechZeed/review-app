import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProfileCard from '../components/ProfileCard';
import QualityHeatMap from '../components/QualityHeatMap';
import type { QualityBar } from '../components/QualityHeatMap';
import ReviewCard from '../components/ReviewCard';
import { fetchProfile, fetchReviews } from '../lib/api';
import type { Review } from '../lib/api';

const QUALITY_COLOR_MAP: Record<string, string> = {
  expertise: '#3B82F6',
  care: '#EC4899',
  delivery: '#22C55E',
  initiative: '#F97316',
  trust: '#8B5CF6',
};

export default function ProfilePage() {
  const { slug } = useParams<{ slug: string }>();

  const profileQuery = useQuery({
    queryKey: ['profile', slug],
    queryFn: () => fetchProfile(slug!),
    enabled: !!slug,
  });

  const reviewsQuery = useQuery({
    queryKey: ['profile', slug, 'reviews'],
    queryFn: () =>
      profileQuery.data
        ? fetchReviews(profileQuery.data.id)
        : Promise.resolve({ reviews: [], total: 0, page: 1, limit: 20 }),
    enabled: !!profileQuery.data,
  });

  const profile = profileQuery.data;
  const reviews = reviewsQuery.data?.reviews || [];
  const qualityBars = buildQualityBars(reviews);

  if (profileQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 text-lg">Loading profile...</div>
      </div>
    );
  }

  if (profileQuery.error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            Profile Not Found
          </h2>
          <p className="text-gray-600 text-sm">
            This profile may be private or does not exist.
          </p>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const refCount = profile.verifiable_references;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">ReviewApp</span>
          <span className="text-xs text-gray-400">Public Profile</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Profile hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ProfileCard profile={profile} />

          <div className="space-y-4">
            <QualityHeatMap qualities={qualityBars} />

            {refCount > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-purple-700">
                  {refCount}
                </div>
                <div className="text-sm text-purple-600 mt-1">
                  Verifiable References
                </div>
                <p className="text-xs text-purple-500 mt-2">
                  People who would vouch for {profile.name} to a future
                  employer
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">
            Reviews ({reviews.length})
          </h3>
          {reviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
              No reviews yet.
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Reviews">
              {reviews.map((review) => (
                <div key={review.id} role="listitem">
                  <ReviewCard review={review} />
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function buildQualityBars(reviews: Review[]): QualityBar[] {
  if (reviews.length === 0) {
    return [
      { name: 'Expertise', percentage: 0, color: '#3B82F6' },
      { name: 'Care', percentage: 0, color: '#EC4899' },
      { name: 'Delivery', percentage: 0, color: '#22C55E' },
      { name: 'Initiative', percentage: 0, color: '#F97316' },
      { name: 'Trust', percentage: 0, color: '#8B5CF6' },
    ];
  }

  const counts: Record<string, number> = {};
  let totalPicks = 0;

  reviews.forEach((r) => {
    r.qualities.forEach((q) => {
      const key = q.toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
      totalPicks++;
    });
  });

  return Object.entries(counts).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    percentage: totalPicks > 0 ? Math.round((count / totalPicks) * 100) : 0,
    color: QUALITY_COLOR_MAP[name] || '#6B7280',
  }));
}
