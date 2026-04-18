import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ProfileCard from '../components/ProfileCard';
import QualityHeatMap from '../components/QualityHeatMap';
import ReviewCard from '../components/ReviewCard';
import { fetchProfile, fetchReviews } from '../lib/api';
import { buildQualityBarsFromProfile } from '../lib/quality';

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
        : Promise.resolve({
            reviews: [],
            pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
          }),
    enabled: !!profileQuery.data,
  });

  const profile = profileQuery.data;
  const reviews = reviewsQuery.data?.reviews || [];
  const qualityBars = buildQualityBarsFromProfile(profile);

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

  return (
    <div className="min-h-screen bg-gray-50" data-testid="profile-root">
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
          <ProfileCard profile={profile} showQR />

          <div className="space-y-4">
            <QualityHeatMap qualities={qualityBars} />
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
