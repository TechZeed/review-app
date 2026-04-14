import { bucket, SIGNED_URL_EXPIRY_MS } from "../../config/storage.js";
import { logger } from "../../config/logger.js";

/**
 * Upload a file buffer to GCS
 */
export async function uploadFile(
  destination: string,
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  const file = bucket.file(destination);

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
    },
    resumable: false,
  });

  logger.info("File uploaded to GCS", { destination, mimeType });
  return destination;
}

/**
 * Generate a signed URL for temporary read access
 */
export async function generateSignedUrl(
  filePath: string,
  expiresInMs: number = SIGNED_URL_EXPIRY_MS,
): Promise<string> {
  const file = bucket.file(filePath);

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + expiresInMs,
  });

  return url;
}

/**
 * Delete a file from GCS
 */
export async function deleteFile(filePath: string): Promise<void> {
  const file = bucket.file(filePath);

  await file.delete({ ignoreNotFound: true });
  logger.info("File deleted from GCS", { filePath });
}
