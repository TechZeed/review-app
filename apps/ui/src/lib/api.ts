const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { token, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    headers,
    ...rest,
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API error ${res.status}: ${body}`);
  }

  return res.json();
}

// ---- Profile ----

export interface QualityBreakdown {
  expertise: number;
  care: number;
  delivery: number;
  initiative: number;
  trust: number;
}

export interface Profile {
  id: string;
  slug: string;
  name: string;
  headline?: string | null;
  bio?: string | null;
  industry?: string | null;
  visibility?: string;
  qrCodeUrl?: string | null;
  reviewCount: number;
  qualityBreakdown?: QualityBreakdown;
  profileUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function fetchProfile(slug: string): Promise<Profile> {
  return apiFetch<Profile>(`/api/v1/profiles/${slug}`);
}

export function fetchMyProfile(token: string): Promise<Profile> {
  return apiFetch<Profile>('/api/v1/profiles/me', { token });
}

// ---- Reviews ----

export interface Review {
  id: string;
  profileId: string;
  qualities: string[];
  thumbsUp?: boolean;
  badgeTier?: 'verified_interaction' | 'verified' | 'standard' | 'low_confidence';
  verifiable?: boolean;
  createdAt: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export function fetchReviews(profileId: string, page = 1, limit = 20): Promise<ReviewsResponse> {
  return apiFetch<ReviewsResponse>(
    `/api/v1/reviews/profile/${profileId}?page=${page}&limit=${limit}`,
  );
}

// ---- Qualities ----

export interface Quality {
  id: string;
  name: string;
  description: string;
  color: string;
}

export function fetchQualities(): Promise<Quality[]> {
  return apiFetch<Quality[]>('/api/v1/qualities');
}

// ---- Auth (dev mock) ----

export interface DevLoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
    name: string;
    profile_slug: string;
  };
}

export function devLogin(role: string): Promise<DevLoginResponse> {
  return apiFetch<DevLoginResponse>('/api/v1/auth/dev-login', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

export { apiFetch };
