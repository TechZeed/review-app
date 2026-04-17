import Constants from "expo-constants";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  messagingSenderId: string;
  appId: string;
}

export interface GoogleOAuthConfig {
  webClientId: string;
  iosClientId: string;
  androidClientId: string;
}

export interface ExtraConfig {
  apiUrl: string;
  webUrl: string;
  dashboardUrl: string;
  firebase: FirebaseConfig;
  googleOAuth: GoogleOAuthConfig;
  eas: { projectId: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<ExtraConfig>;

export const apiUrl: string = extra.apiUrl ?? "";
export const webUrl: string = extra.webUrl ?? "";
export const dashboardUrl: string = extra.dashboardUrl ?? "";
export const firebaseConfig: FirebaseConfig = (extra.firebase ?? {
  apiKey: "",
  authDomain: "",
  projectId: "",
  messagingSenderId: "",
  appId: "",
}) as FirebaseConfig;
export const googleOAuth: GoogleOAuthConfig = (extra.googleOAuth ?? {
  webClientId: "",
  iosClientId: "",
  androidClientId: "",
}) as GoogleOAuthConfig;
