import { Storage } from "@google-cloud/storage";
import { env } from "./env.js";

const storage = new Storage({
  projectId: env.GCP_PROJECT_ID,
});

export const bucket = storage.bucket(env.GCP_BUCKET_NAME);

export const SIGNED_URL_EXPIRY_MS = 60 * 60 * 1000; // 1 hour default

export { storage };
