// Shared appconfig loader used by both vite.config.ts and vitest.config.ts.
// Reads APP_ENV (default `local`), loads the matching committed JSON, and
// returns a `define` record that inlines both APP_CONFIG and the legacy
// `import.meta.env.VITE_*` shims used by code that hasn't migrated yet.

import fs from "node:fs";
import path from "node:path";

export interface LoadedConfig {
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
  features: { emailLogin: boolean };
}

export function loadAppConfig(rootDir: string, appEnv?: string): LoadedConfig {
  const env = appEnv || process.env.APP_ENV || "local";
  const configPath = path.resolve(rootDir, `config/appconfig.${env}.json`);
  if (!fs.existsSync(configPath)) {
    throw new Error(`[appconfig] not found for APP_ENV=${env}: ${configPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf8")) as LoadedConfig;
  } catch (err) {
    throw new Error(`[appconfig] failed to parse ${configPath}: ${(err as Error).message}`);
  }
}

export function buildDefines(cfg: LoadedConfig): Record<string, string> {
  return {
    APP_CONFIG: JSON.stringify(cfg),
    // Back-compat shims — remove once all import.meta.env.VITE_* call sites
    // have migrated to `config.*`. See spec 26 Follow-up Migration.
    "import.meta.env.VITE_API_URL": JSON.stringify(cfg.apiUrl),
    "import.meta.env.VITE_PUBLIC_REVIEW_URL": JSON.stringify(cfg.publicReviewUrl),
    "import.meta.env.VITE_FIREBASE_API_KEY": JSON.stringify(cfg.firebase.apiKey),
    "import.meta.env.VITE_FIREBASE_AUTH_DOMAIN": JSON.stringify(cfg.firebase.authDomain),
    "import.meta.env.VITE_FIREBASE_PROJECT_ID": JSON.stringify(cfg.firebase.projectId),
    "import.meta.env.VITE_FIREBASE_STORAGE_BUCKET": JSON.stringify(cfg.firebase.storageBucket),
    "import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID": JSON.stringify(cfg.firebase.messagingSenderId),
    "import.meta.env.VITE_FIREBASE_APP_ID": JSON.stringify(cfg.firebase.appId),
    "import.meta.env.VITE_FIREBASE_MEASUREMENT_ID": JSON.stringify(cfg.firebase.measurementId ?? ""),
    "import.meta.env.VITE_FEATURE_EMAIL_LOGIN": JSON.stringify(String(cfg.features.emailLogin)),
  };
}
