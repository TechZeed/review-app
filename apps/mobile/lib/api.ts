import { apiUrl } from "./env";
import { getToken } from "./storage";

interface ApiFetchOptions extends RequestInit {
  // Callers may override the auth token; default is whatever is in SecureStore.
  token?: string | null;
}

// Global 401 handler. AuthProvider subscribes via onAuthError so a 401 from any
// endpoint bounces the user back to login.
type AuthErrorHandler = () => void;
let authErrorHandler: AuthErrorHandler | null = null;

export function onAuthError(handler: AuthErrorHandler | null): void {
  authErrorHandler = handler;
}

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

export async function apiFetch<T>(
  path: string,
  opts: ApiFetchOptions = {},
): Promise<T> {
  const { token: explicitToken, headers: customHeaders, ...rest } = opts;

  const token =
    explicitToken === undefined ? await getToken() : explicitToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((customHeaders as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${apiUrl}${path}`, { headers, ...rest });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 401 && authErrorHandler) {
      authErrorHandler();
    }
    throw new ApiError(res.status, body);
  }

  return (await res.json()) as T;
}

// ---- Typed shapes (client-side assumption; verified against real API) ----

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export interface ExchangeTokenResponse {
  token: string;
  user: AuthUser;
}

// Spec 21's assumed shape; `qualityBreakdown` is missing from /me today
// (see spec 19 B4) so it's optional and we merge from /profiles/:slug.
export interface Profile {
  id: string;
  slug: string;
  name: string;
  headline?: string;
  industry?: string;
  bio?: string;
  reviewCount: number;
  qualityBreakdown?: Record<string, number>;
  profileUrl?: string;
}

export interface Review {
  id: string;
  profile_id: string;
  qualities: string[];
  media_type?: "text" | "voice" | "video";
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

// ---- Endpoints ----

export function fetchMe(): Promise<Profile> {
  return apiFetch<Profile>("/api/v1/profiles/me");
}

export function fetchProfile(slug: string): Promise<Profile> {
  return apiFetch<Profile>(`/api/v1/profiles/${slug}`);
}

export function fetchReviews(
  profileId: string,
  page = 1,
  limit = 20,
): Promise<ReviewsResponse> {
  return apiFetch<ReviewsResponse>(
    `/api/v1/reviews/profile/${profileId}?page=${page}&limit=${limit}`,
  );
}

export function exchangeToken(
  firebaseIdToken: string,
): Promise<ExchangeTokenResponse> {
  // Spec 19 B3: API expects `firebaseToken` (not `firebaseIdToken`). Rename on
  // wire only; the value is still the Firebase ID token.
  return apiFetch<ExchangeTokenResponse>("/api/v1/auth/exchange-token", {
    method: "POST",
    body: JSON.stringify({ firebaseToken: firebaseIdToken }),
    token: null,
  });
}
