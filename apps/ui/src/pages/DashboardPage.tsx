import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { useAuth } from '../App';
import NavBar from '../components/NavBar';
import ProfileCard from '../components/ProfileCard';
import QualityHeatMap from '../components/QualityHeatMap';
import type { QualityBar } from '../components/QualityHeatMap';
import ReviewCard from '../components/ReviewCard';
import {
  fetchMyProfile,
  fetchReviews,
  fetchQualities,
  updateMyProfile,
} from '../lib/api';
import type { Profile, Review } from '../lib/api';
import { buildQualityBarsFromProfile } from '../lib/quality';

interface ProfileFormValues {
  headline: string;
  bio: string;
  industry: string;
}

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [initialValues, setInitialValues] = useState<ProfileFormValues>({
    headline: '',
    bio: '',
    industry: '',
  });
  const [formValues, setFormValues] = useState<ProfileFormValues>({
    headline: '',
    bio: '',
    industry: '',
  });

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

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const payload: { headline?: string; bio?: string; industry?: string } = {};
      if (values.headline !== initialValues.headline) payload.headline = values.headline;
      if (values.bio !== initialValues.bio) payload.bio = values.bio;
      if (values.industry !== initialValues.industry) payload.industry = values.industry;

      if (Object.keys(payload).length === 0) return;
      await updateMyProfile(user!.token, payload);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      setIsEditOpen(false);
      setEditError(null);
    },
    onError: (error: unknown) => {
      setEditError(error instanceof Error ? error.message : 'Failed to save profile');
    },
  });

  const openEditModal = () => {
    if (!profile) return;
    const values = {
      headline: profile.headline ?? '',
      bio: profile.bio ?? '',
      industry: profile.industry ?? '',
    };
    setInitialValues(values);
    setFormValues(values);
    setEditError(null);
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (updateProfileMutation.isPending) return;
    setIsEditOpen(false);
    setEditError(null);
  };

  const onEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setEditError(null);
    updateProfileMutation.mutate(formValues);
  };

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard-root">
      <NavBar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {profile ? (
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              data-testid="edit-profile-button"
              className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              onClick={openEditModal}
            >
              Edit profile
            </button>
          </div>
        ) : null}

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

        {isEditOpen ? (
          <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="w-full max-w-lg bg-white rounded-xl border border-gray-200 shadow-xl p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Edit profile</h2>
              <form data-testid="profile-edit-form" className="space-y-4" onSubmit={onEditSubmit}>
                <div>
                  <label htmlFor="headline" className="block text-sm font-medium text-gray-700 mb-1">
                    Headline
                  </label>
                  <input
                    id="headline"
                    type="text"
                    value={formValues.headline}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, headline: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={formValues.bio}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, bio: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label htmlFor="industry" className="block text-sm font-medium text-gray-700 mb-1">
                    Industry
                  </label>
                  <input
                    id="industry"
                    type="text"
                    value={formValues.industry}
                    onChange={(event) =>
                      setFormValues((prev) => ({ ...prev, industry: event.target.value }))
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {editError ? (
                  <p className="text-sm text-red-600" role="alert">
                    {editError}
                  </p>
                ) : null}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    disabled={updateProfileMutation.isPending}
                    className="px-4 py-2 rounded-md border border-gray-300 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    data-testid="save-profile-button"
                    disabled={updateProfileMutation.isPending}
                    className="px-4 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    {updateProfileMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </form>
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
