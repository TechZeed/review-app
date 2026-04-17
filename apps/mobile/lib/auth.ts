import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
} from "firebase/auth";

import { exchangeToken, type AuthUser } from "./api";
import { firebaseConfig, googleOAuth } from "./env";
import { setToken } from "./storage";

// Ensure the auth-session web browser result is dismissed on return.
WebBrowser.maybeCompleteAuthSession();

export type { AuthUser } from "./api";

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
}

/**
 * Returns true when every Google OAuth client ID has a real value. Until
 * Muthu wires the IDs in `app.json`, the TODO placeholder strings start with
 * "TODO " so we detect that prefix and disable the sign-in flow.
 */
export function isGoogleConfigured(): boolean {
  const ids = [
    googleOAuth.webClientId,
    googleOAuth.iosClientId,
    googleOAuth.androidClientId,
  ];
  return ids.every((id) => !!id && !id.startsWith("TODO"));
}

let firebaseAppRef: FirebaseApp | null = null;

function ensureFirebaseApp(): FirebaseApp {
  if (firebaseAppRef) return firebaseAppRef;
  const existing = getApps();
  firebaseAppRef = existing.length > 0 ? existing[0]! : initializeApp(firebaseConfig);
  return firebaseAppRef;
}

/**
 * Hook wrapper around `expo-auth-session/providers/google#useAuthRequest`.
 * Returns the tuple [request, response, promptAsync]. Callers drive the flow
 * by calling `promptAsync()` and then, on `response.type === "success"`,
 * passing `response.authentication.idToken` to `completeSignIn`.
 */
export function useGoogleSignIn() {
  return Google.useAuthRequest({
    clientId: googleOAuth.webClientId,
    iosClientId: googleOAuth.iosClientId,
    androidClientId: googleOAuth.androidClientId,
    scopes: ["profile", "email"],
  });
}

/**
 * Second half of the sign-in flow: exchange Google ID token for a Firebase
 * credential, sign into Firebase to mint a Firebase ID token, POST that token
 * to `/auth/exchange-token`, persist the returned app JWT.
 */
export async function completeSignIn(
  googleIdToken: string,
): Promise<{ token: string; user: AuthUser }> {
  const app = ensureFirebaseApp();
  const auth = getAuth(app);

  const credential = GoogleAuthProvider.credential(googleIdToken);
  const userCredential = await signInWithCredential(auth, credential);
  const firebaseIdToken = await userCredential.user.getIdToken();

  const { token, user } = await exchangeToken(firebaseIdToken);
  await setToken(token);
  return { token, user };
}
