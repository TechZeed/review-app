/**
 * Integration test harness — thin wrapper over an externally-managed test
 * stack (docker-compose.test.yml). See docs/specs/20-integration-tests.md.
 *
 * Responsibilities:
 *   1. Load .env.test (override:true so tests/utils/setup.ts's hardcoded
 *      process.env values don't shadow our real test config).
 *   2. Initialise Sequelize against the already-running test Postgres.
 *   3. Dynamically import the Express app AFTER env is finalised — this
 *      dodges the env.ts import-time snapshot that would otherwise lock in
 *      stale values.
 *   4. Return fixture handles (no DB writes — assumes test:db:seed ran).
 *
 * Lifecycle (docker-compose up/down) is owned by Taskfile.local.yml, not
 * by this harness. Per-file teardown is a no-op.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import type { Sequelize } from "sequelize";
import type { Express } from "express";
import { getSeededTestData, type SeededTestData } from "./seed.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../../../..");

export interface BootstrappedStack {
  app: Express;
  sequelize: Sequelize;
  seeded: SeededTestData;
  teardown: () => Promise<void>;
}

let cached: BootstrappedStack | null = null;

export async function bootstrapTestStack(): Promise<BootstrappedStack> {
  if (cached) return cached;

  // 1. Load .env.test with override so the global vitest setupFile's
  //    process.env assignments don't win.
  dotenv.config({ path: path.join(REPO_ROOT, ".env.test"), override: true });

  // 2. Initialise Sequelize against the docker-compose Postgres (already up).
  const { initDb, getSequelize } = await import("../../src/config/sequelize.js");
  await initDb();
  const sequelize = getSequelize();

  // 3. Import the Express app LAST, after env is finalised.
  const { app } = await import("../../src/app.js");

  cached = {
    app,
    sequelize,
    seeded: getSeededTestData(),
    teardown: async () => {
      // no-op: docker-compose lifecycle owned by Taskfile (test:db:down)
    },
  };
  return cached;
}
