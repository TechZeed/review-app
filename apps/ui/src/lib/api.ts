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

export interface Profile {
  id: string;
  slug: string;
  name: string;
  photo_url?: string;
  role?: string;
  org_name?: string;
  industry?: string;
  total_reviews: number;
  verifiable_references: number;
  visibility?: string;
  created_at?: string;
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
  profile_id: string;
  qualities: string[];
  media_type?: 'text' | 'voice' | 'video';
  text_content?: string;
  verified_interaction?: boolean;
  verifiable_reference?: boolean;
  created_at: string;
}

export interface ReviewsResponse {
  reviews: Review[];
  total: number;
  page: number;
  limit: number;
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
