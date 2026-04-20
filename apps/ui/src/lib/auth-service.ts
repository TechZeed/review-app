import {
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth, googleProvider } from './firebase';
import { apiFetch } from './api';
import type { components } from '../api-types';

export type ExchangeTokenResponse = components['schemas']['ExchangeTokenResponse'];

/**
 * Sign in with Google via Firebase popup, then exchange the Firebase ID token
 * for an app JWT from the backend.
 */
export async function signInWithGoogle(): Promise<ExchangeTokenResponse> {
  const result = await signInWithPopup(auth, googleProvider);
  const firebaseToken = await result.user.getIdToken();
  return exchangeToken(firebaseToken);
}

/**
 * Exchange a Firebase ID token for an app-level JWT.
 */
export async function exchangeToken(firebaseToken: string): Promise<ExchangeTokenResponse> {
  return apiFetch<ExchangeTokenResponse>('/api/v1/auth/exchange-token', {
    method: 'POST',
    body: JSON.stringify({ firebaseToken }),
  });
}

/**
 * Sign in with email+password for admin-provisioned accounts. Reqsume-style:
 * password hash lives in our own `users` table (bcrypt), Firebase is not
 * involved. Feature-gated in the UI via VITE_FEATURE_EMAIL_LOGIN (see spec 16).
 */
export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<ExchangeTokenResponse> {
  return apiFetch<ExchangeTokenResponse>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

/**
 * Sign out from Firebase and clear local storage.
 */
export async function signOutUser(): Promise<void> {
  await firebaseSignOut(auth);
  localStorage.removeItem('auth_user');
}
