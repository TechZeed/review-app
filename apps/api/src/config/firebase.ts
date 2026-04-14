import admin from "firebase-admin";
import { env } from "./env.js";
import { logger } from "./logger.js";

let firebaseApp: admin.app.App | null = null;
let firebaseInitError: Error | null = null;

export function initializeFirebase(): void {
  if (firebaseApp || firebaseInitError) {
    if (firebaseInitError) {
      throw firebaseInitError;
    }
    return;
  }

  try {
    // Option 1: Inline credentials from env vars
    if (env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: env.FIREBASE_PROJECT_ID,
          clientEmail: env.FIREBASE_CLIENT_EMAIL,
          privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        }),
      });
    }
    // Option 2: GOOGLE_APPLICATION_CREDENTIALS file path (auto-detected by SDK)
    else if (env.GOOGLE_APPLICATION_CREDENTIALS) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: env.FIREBASE_PROJECT_ID,
      });
    }
    // Option 3: Default application credentials (Cloud Run, GCE)
    else {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: env.FIREBASE_PROJECT_ID,
      });
    }

    logger.info("Firebase initialized");
  } catch (error) {
    firebaseInitError =
      error instanceof Error ? error : new Error("Failed to initialize Firebase");
    logger.error("Failed to initialize Firebase", { error });
    throw firebaseInitError;
  }
}

export function getFirebaseAuth(): admin.auth.Auth {
  if (!firebaseApp) {
    throw firebaseInitError ?? new Error("Firebase not initialized");
  }

  return admin.auth(firebaseApp);
}
