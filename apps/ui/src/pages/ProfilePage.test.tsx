import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Profile, ReviewsResponse } from '../lib/api';

// Mock ShareQRButton which isn't under test and pulls DOM APIs we don't need.
vi.mock('../components/ShareQRButton', () => ({
  default: () => null,
}));

// Mock the api module so we control what fetchProfile/fetchReviews return.
vi.mock('../lib/api', async () => {
  const actual = await vi.importActual<typeof import('../lib/api')>('../lib/api');
  return {
    ...actual,
    fetchProfile: vi.fn(),
    fetchReviews: vi.fn(),
  };
});

import ProfilePage from './ProfilePage';
import { fetchProfile, fetchReviews } from '../lib/api';

const mockFetchProfile = fetchProfile as unknown as ReturnType<typeof vi.fn>;
const mockFetchReviews = fetchReviews as unknown as ReturnType<typeof vi.fn>;

function renderProfilePage(slug = 'ramesh-kumar') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/profile/${slug}`]}>
        <Routes>
          <Route path="/profile/:slug" element={<ProfilePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function baseProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'profile-1',
    slug: 'ramesh-kumar',
    name: 'Ramesh Kumar',
    headline: 'Senior Sales Consultant',
    industry: 'auto_sales',
    reviewCount: 150,
    qualityBreakdown: {
      expertise: 35,
      care: 12,
      delivery: 20,
      initiative: 8,
      trust: 25,
    },
    ...overrides,
  };
}

const emptyReviews: ReviewsResponse = {
  reviews: [],
  pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
};

describe('ProfilePage', () => {
  beforeEach(() => {
    mockFetchProfile.mockReset();
    mockFetchReviews.mockReset();
  });

  it('renders all 5 quality bars with correct percentages when qualityBreakdown is uneven', async () => {
    mockFetchProfile.mockResolvedValue(baseProfile());
    mockFetchReviews.mockResolvedValue(emptyReviews);

    renderProfilePage();

    await waitFor(() =>
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument(),
    );
    expect(screen.getByText('35%')).toBeInTheDocument();
    expect(screen.getByText('12%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('8%')).toBeInTheDocument();
    expect(screen.getByText('25%')).toBeInTheDocument();
  });

  it('ahmed-hassan regression: uniform qualityBreakdown still renders all 5 bars (expertise not dropped)', async () => {
    mockFetchProfile.mockResolvedValue(
      baseProfile({
        slug: 'ahmed-hassan',
        name: 'Ahmed Hassan',
        qualityBreakdown: {
          expertise: 20,
          care: 20,
          delivery: 20,
          initiative: 20,
          trust: 20,
        },
      }),
    );
    mockFetchReviews.mockResolvedValue(emptyReviews);

    renderProfilePage('ahmed-hassan');

    await waitFor(() =>
      expect(screen.getByText('Ahmed Hassan')).toBeInTheDocument(),
    );
    expect(screen.getByText('Expertise')).toBeInTheDocument();
    expect(screen.getByText('Care')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByText('Trust')).toBeInTheDocument();
    // All five show 20%
    expect(screen.getAllByText('20%')).toHaveLength(5);
  });

  it('renders 5 bars at 0% when qualityBreakdown is absent', async () => {
    mockFetchProfile.mockResolvedValue(baseProfile({ qualityBreakdown: undefined }));
    mockFetchReviews.mockResolvedValue(emptyReviews);

    renderProfilePage();

    await waitFor(() =>
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument(),
    );
    expect(screen.getByText('Expertise')).toBeInTheDocument();
    expect(screen.getByText('Care')).toBeInTheDocument();
    expect(screen.getByText('Delivery')).toBeInTheDocument();
    expect(screen.getByText('Initiative')).toBeInTheDocument();
    expect(screen.getByText('Trust')).toBeInTheDocument();
    expect(screen.getAllByText('0%')).toHaveLength(5);
  });

  it('renders name and headline together', async () => {
    mockFetchProfile.mockResolvedValue(baseProfile());
    mockFetchReviews.mockResolvedValue(emptyReviews);

    renderProfilePage();

    await waitFor(() =>
      expect(screen.getByText('Ramesh Kumar')).toBeInTheDocument(),
    );
    expect(screen.getByText('Senior Sales Consultant')).toBeInTheDocument();
  });

  it('renders review list from paginated response', async () => {
    mockFetchProfile.mockResolvedValue(baseProfile());
    mockFetchReviews.mockResolvedValue({
      reviews: [
        {
          id: 'r1',
          profileId: 'profile-1',
          qualities: ['expertise', 'trust'],
          thumbsUp: true,
          badgeTier: 'verified_interaction',
          verifiable: false,
          createdAt: '2026-04-18T02:30:30.600Z',
        },
        {
          id: 'r2',
          profileId: 'profile-1',
          qualities: ['care'],
          thumbsUp: true,
          verifiable: false,
          createdAt: '2026-04-17T02:30:30.600Z',
        },
      ],
      pagination: { page: 1, limit: 2, total: 150, totalPages: 75 },
    });

    renderProfilePage();

    await waitFor(() => {
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
    });
    // Date formats visible, not Invalid Date
    expect(screen.queryByText(/Invalid Date/)).not.toBeInTheDocument();
  });
});
