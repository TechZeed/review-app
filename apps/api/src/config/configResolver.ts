import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { accessSync, constants as fsConstants } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { logger } from "./logger.js";

/**
 * ConfigResolver — resolves configuration values from:
 *   1. Environment variables (checked first)
 *   2. GCP Secret Manager (fallback)
 *
 * In development: .env.dev has everything, Secret Manager is never hit.
 * In production: env vars may reference Secret Manager, or be injected by Cloud Run.
 * This resolver handles both cases transparently.
 */

let smClient: SecretManagerServiceClient | null = null;
const secretCache = new Map<string, string>();

// Mapping: env var name → Secret Manager secret name
const SECRET_MAP: Record<string, string> = {
  JWT_SECRET: "review-jwt-secret",
  POSTGRES_PASSWORD: "review-db-password",
  POSTGRES_HOST: "review-db-host",
  POSTGRES_DB: "review-db-name",
  POSTGRES_USER: "review-db-user",
  STRIPE_SECRET_KEY: "review-stripe-secret",
  STRIPE_WEBHOOK_SECRET: "review-stripe-webhook-secret",
};

function getClient(): SecretManagerServiceClient {
  if (!smClient) {
    smClient = new SecretManagerServiceClient();
  }
  return smClient;
}

/**
 * Fetch a secret from GCP Secret Manager.
 * Results are cached for the lifetime of the process.
 */
async function fetchFromVault(secretName: string): Promise<string | null> {
  // Check cache first
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName)!;
  }

  const projectId = process.env.GCP_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    return null;
  }

  try {
    const client = getClient();
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretName}/versions/latest`,
    });

    const payload = version.payload?.data?.toString();
    if (payload) {
      secretCache.set(secretName, payload);
      logger.debug(`Secret resolved from vault: ${secretName}`);
      return payload;
    }
    return null;
  } catch (err: any) {
    logger.debug(`Secret not found in vault: ${secretName} (${err.message})`);
    return null;
  }
}

/**
 * Resolve a config value:
 *   1. Check process.env[key]
 *   2. If not found and key is in SECRET_MAP, check GCP Secret Manager
 *   3. Return defaultValue if neither has it
 */
export async function resolveConfig(
  key: string,
  defaultValue?: string,
): Promise<string | undefined> {
  // 1. Environment variable (always wins)
  const envValue = process.env[key];
  if (envValue !== undefined && envValue !== "") {
    return envValue;
  }

  // 2. GCP Secret Manager fallback
  const secretName = SECRET_MAP[key];
  if (secretName) {
    const vaultValue = await fetchFromVault(secretName);
    if (vaultValue) {
      // Also set it in process.env so downstream code (Zod schema, etc.) picks it up
      process.env[key] = vaultValue;
      return vaultValue;
    }
  }

  // 3. Default
  return defaultValue;
}

/**
 * Resolve all mapped secrets at startup.
 * Call this before parsing the Zod env schema.
 * In dev: .env.dev is loaded, so all env vars exist — vault is never hit.
 * In prod: Cloud Run injects some vars, vault fills the rest.
 */
export async function resolveAllSecrets(): Promise<void> {
  const isDev = process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";

  // In dev, env vars are already loaded from .env file — skip vault
  const missingKeys = Object.keys(SECRET_MAP).filter(
    (key) => !process.env[key] || process.env[key] === "",
  );

  if (missingKeys.length === 0) {
    logger.info("All config resolved from environment variables");
    return;
  }

  if (isDev) {
    logger.warn(`Missing env vars in dev mode: ${missingKeys.join(", ")}. Check your .env.dev file.`);
    return;
  }

  // Production: resolve missing keys from vault
  logger.info(`Resolving ${missingKeys.length} secrets from vault...`);
  const results = await Promise.allSettled(
    missingKeys.map((key) => resolveConfig(key)),
  );

  const resolved = results.filter((r) => r.status === "fulfilled" && r.value).length;
  const failed = missingKeys.length - resolved;

  logger.info(`Secrets resolved: ${resolved} from vault, ${failed} still missing`);

  if (failed > 0) {
    const stillMissing = missingKeys.filter((key) => !process.env[key]);
    logger.warn(`Still missing after vault lookup: ${stillMissing.join(", ")}`);
  }
}

/**
 * Get the full secret map (for documentation/debugging).
 */
export function getSecretMap(): Record<string, string> {
  return { ...SECRET_MAP };
}

/**
 * Add a custom secret mapping at runtime.
 */
export function addSecretMapping(envKey: string, secretName: string): void {
  SECRET_MAP[envKey] = secretName;
}

/**
 * Clear the secret cache (useful for testing).
 */
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Resolve a vault-file path from an env var. The env var's value is already
 * the filepath — absolute on Cloud Run (via --set-secrets mount, e.g.
 * /secrets/firebase-sa.json), relative to apps/api cwd locally (e.g.
 * ../../infra/dev/vault/firebase-sa.json). Returns the resolved absolute path.
 *
 * Never hits Secret Manager — file writing is the environment's job:
 *   - Cloud Run: `--set-secrets` mount writes before entrypoint
 *   - GitHub Actions: `hydrate-vault` composite action writes to disk
 *   - Local dev: `task dev:vault:pull` writes once per machine
 *
 * Throws if the env var is missing. The startup sanity check
 * (`verifyVaultFiles`) is expected to catch missing files before any caller
 * reaches this, but we still resolve defensively.
 *
 * See docs/specs/22-file-vault-pattern.md.
 */
export function resolveFilePath(envKey: string): string {
  const raw = process.env[envKey];
  if (!raw) {
    throw new Error(
      `${envKey} not set. Run 'task dev:vault:pull' locally, or check --set-secrets on Cloud Run deploy.`,
    );
  }
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

// System env vars that end in _PATH but are OS-level search path lists,
// not vault file pointers. Skip them in verifyVaultFiles.
const SYSTEM_PATH_VARS = new Set([
  "PATH",
  "LIBRARY_PATH",
  "LD_LIBRARY_PATH",
  "DYLD_LIBRARY_PATH",
  "DYLD_FALLBACK_LIBRARY_PATH",
  "MANPATH",
  "INFOPATH",
  "PYTHONPATH",
  "CLASSPATH",
  "NODE_PATH",
  "GOPATH",
  "CDPATH",
  "FPATH",
  "TYPESCRIPT_PATH",
]);

/**
 * Startup sanity check for vault files: every env var whose key ends in _PATH
 * must point to a readable file. Fails fast at boot rather than leaving a
 * broken readFileSync waiting to surface in request handling.
 *
 * Skips OS-level path-list variables (LIBRARY_PATH, NODE_PATH, etc.) and
 * any value containing `:` (which in *nix always indicates a multi-path
 * list, never a single vault file).
 */
export function verifyVaultFiles(): void {
  const missing: string[] = [];
  const checked: string[] = [];
  for (const key of Object.keys(process.env)) {
    if (!key.endsWith("_PATH")) continue;
    if (SYSTEM_PATH_VARS.has(key)) continue;
    const val = process.env[key];
    if (!val) continue;
    if (val.includes(":") && !/^[A-Z]:\\/.test(val)) continue; // path-list, not a single file (Windows drive letters excluded)
    const abs = isAbsolute(val) ? val : resolve(process.cwd(), val);
    try {
      accessSync(abs, fsConstants.R_OK);
      checked.push(`${key}=${abs}`);
    } catch {
      missing.push(`${key} → ${abs}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `Vault files missing or unreadable:\n  ${missing.join("\n  ")}\n` +
        `Run 'task dev:vault:pull' locally, or verify --set-secrets on the Cloud Run deploy.`,
    );
  }
  logger.info(`Vault files verified at startup (${checked.length} checked)`);
}
