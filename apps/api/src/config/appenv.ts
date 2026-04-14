import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { logger } from "./logger.js";
import { env } from "./env.js";

/**
 * Helper to expand ~, $, ${VAR}, ., .. and resolve to absolute path
 */
const expandPath = (filepath: string): string => {
  // Expand environment variables like $HOME or ${HOME}
  filepath = filepath.replace(/\$\{?([A-Z_][A-Z0-9_]*)\}?/gi, (_match, varName) => {
    return process.env[varName] ?? _match;
  });

  // Expand ~ to home directory
  if (filepath.startsWith("~/")) {
    filepath = filepath.replace("~", homedir());
  }

  // Resolve relative paths and normalize
  return resolve(filepath);
};

export const appenv = {
  /**
   * Get environment variable value
   *
   * Resolution order:
   * 1. env.ts (validated, typed)
   * 2. process.env (raw)
   */
  get(key: string): string {
    const v = (env as Record<string, any>)[key];
    if (typeof v === "string") return v;

    const pv = process.env[key];
    return typeof pv === "string" ? pv : "";
  },

  getAsNumber(key: string): number | undefined {
    const v = this.get(key);
    return v !== "" ? parseInt(v) : undefined;
  },

  /**
   * Get environment variable as resolved file path
   *
   * - Expands ~
   * - Expands $VARS
   * - Resolves to absolute path
   * - Ensures file exists
   */
  getAsFilePath(key: string): string | undefined {
    const value = this.get(key);

    if (!value || typeof value !== "string") {
      return undefined;
    }

    const resolvedPath = expandPath(value);

    if (!existsSync(resolvedPath)) {
      logger.error(`File path from env var ${key} does not exist`, {
        key,
        resolvedPath,
      });
      throw new Error(`File path from env var ${key} does not exist: ${resolvedPath}`);
    }

    return resolvedPath;
  },
};
