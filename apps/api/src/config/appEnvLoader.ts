/**
 * loadAppEnvDefaults — load the committed env-specific defaults from
 * `apps/api/config/application.<env>.env`.
 *
 * Two-layer env pattern:
 *   1. THIS file (committed, non-secret defaults) → loaded first
 *   2. process.env (already populated by dotenv from .env.* locally, or by
 *      Cloud Run --set-env-vars/--set-secrets in prod) → overrides
 *
 * `override: false` means anything already set in process.env wins. That's
 * correct: Cloud Run / .env.* are the source of truth for runtime overrides.
 *
 * Selector: `APP_ENV` (explicit), falling back to a mapping of NODE_ENV:
 *   development → local
 *   test        → test
 *   production  → prod
 *   (dev is never NODE_ENV — run.sh / Taskfile / Dockerfile set APP_ENV=dev.)
 */
import { config as dotenvConfig } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const VALID_ENVS = new Set(["local", "dev", "test", "prod"]);

function resolveAppEnv(): string {
  const explicit = process.env.APP_ENV?.trim();
  if (explicit && VALID_ENVS.has(explicit)) return explicit;

  const nodeEnv = process.env.NODE_ENV?.trim();
  if (nodeEnv === "production") return "prod";
  if (nodeEnv === "test") return "test";
  return "local";
}

const here = dirname(fileURLToPath(import.meta.url));

export function loadAppEnvDefaults(): { appEnv: string; file: string | null } {
  const appEnv = resolveAppEnv();
  // Try cwd-relative first (typical for Docker where WORKDIR is /app), then
  // source-relative (typical when running via tsx from apps/api).
  const candidates = [
    resolve(process.cwd(), `config/application.${appEnv}.env`),
    resolve(here, `../../config/application.${appEnv}.env`),
  ];
  const file = candidates.find((p) => existsSync(p)) ?? null;
  if (!file) {
    console.warn(
      `[appEnv] application.${appEnv}.env not found in any of:\n  ${candidates.join("\n  ")}`,
    );
    process.env.APP_ENV = appEnv;
    return { appEnv, file: null };
  }
  dotenvConfig({ path: file, override: false });
  process.env.APP_ENV = appEnv;
  return { appEnv, file };
}
