/**
 * Standalone seeder for the test DB.
 *
 * Usage (from apps/api):
 *   npx tsx --env-file=../../.env.test tests/integration/seed-cli.ts
 *
 * Orchestrated by Taskfile.local.yml `test:db:seed` task.
 *
 * Assumes the test Postgres is running on the host/port from .env.test
 * and that migrations have already been applied (run test:db:migrate first).
 */

import { initDb, getSequelize, shutdownDb } from "../../src/config/sequelize.js";
import { seedTestData } from "./seed.js";

async function main() {
  await initDb();
  const sequelize = getSequelize();
  const seeded = await seedTestData(sequelize);
  console.log("Seeded test data:");
  console.log(JSON.stringify(seeded, null, 2));
  await shutdownDb();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
