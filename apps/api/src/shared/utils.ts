import { createHash } from "node:crypto";
import { nanoid } from "nanoid";

/**
 * Hash a phone number using SHA-256
 * Used to store phone numbers in a privacy-preserving way
 */
export function hashPhone(phone: string): string {
  return createHash("sha256").update(phone.trim()).digest("hex");
}

/**
 * Generate a URL-safe slug using nanoid
 * Length between 8-12 characters
 */
export function generateSlug(length: number = 10): string {
  if (length < 8) length = 8;
  if (length > 12) length = 12;
  return nanoid(length);
}

/**
 * Build pagination options for Sequelize findAll
 */
export function paginateQuery(
  page: number = 1,
  limit: number = 20,
): { offset: number; limit: number } {
  const safePage = Math.max(1, page);
  const safeLimit = Math.min(Math.max(1, limit), 100);

  return {
    offset: (safePage - 1) * safeLimit,
    limit: safeLimit,
  };
}

/**
 * Format a standard API response
 */
export function formatResponse<T>(data: T, meta?: Record<string, any>) {
  return {
    data,
    ...(meta ? { meta } : {}),
  };
}
