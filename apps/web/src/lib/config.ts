// Typed accessor for the committed appconfig.{APP_ENV}.json file.
// Vite inlines APP_CONFIG at build time via `define` in vite.config.ts.
// No runtime fetch, no drift between env files and deploy plumbing.

export interface AppConfig {
  apiUrl: string;
  publicReviewUrl: string;
  firebase: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
    measurementId?: string;
  };
  features: {
    emailLogin: boolean;
  };
}

declare const APP_CONFIG: AppConfig;

export const config: AppConfig = APP_CONFIG;
