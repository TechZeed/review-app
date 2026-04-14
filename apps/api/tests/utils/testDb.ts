/**
 * Test database setup/teardown using testcontainers.
 *
 * Integration and e2e tests spin up an ephemeral Postgres instance per suite.
 * Unit tests never touch this module — they mock all repos.
 */

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "testcontainers";
import { Sequelize } from "sequelize";

let container: StartedPostgreSqlContainer;
let sequelize: Sequelize;

/**
 * Spin up a fresh Postgres container and run all migrations.
 * Returns a connected Sequelize instance.
 */
export async function setupTestDb(): Promise<Sequelize> {
  container = await new PostgreSqlContainer("postgres:16-alpine")
    .withDatabase("review_app_test")
    .withUsername("test_user")
    .withPassword("test_password")
    .withExposedPorts(5432)
    .start();

  const connectionUri = container.getConnectionUri();

  sequelize = new Sequelize(connectionUri, {
    dialect: "postgres",
    logging: false,
  });

  // Verify the connection works
  await sequelize.authenticate();

  // Run migrations if the migrate module is available
  try {
    const { migrateUp } = await import("../../src/db/migrate.js");
    await migrateUp(sequelize);
  } catch {
    // If migrate module is not yet implemented, create tables via sync
    // This will be replaced once migrations are in place
    console.warn(
      "[testDb] Migrations module not available — skipping auto-migrate.",
    );
  }

  return sequelize;
}

/**
 * Get the current test Sequelize instance.
 * Throws if setupTestDb was not called.
 */
export function getTestSequelize(): Sequelize {
  if (!sequelize) {
    throw new Error(
      "Test database not initialized. Call setupTestDb() in beforeAll.",
    );
  }
  return sequelize;
}

/**
 * Close the Sequelize connection and stop the container.
 */
export async function teardownTestDb(): Promise<void> {
  if (sequelize) {
    await sequelize.close();
  }
  if (container) {
    await container.stop();
  }
}

/**
 * Truncate all application tables (CASCADE).
 * Call in `beforeEach` for test isolation between individual tests.
 */
export async function truncateAllTables(db?: Sequelize): Promise<void> {
  const seq = db ?? sequelize;
  if (!seq) return;

  const tables = [
    "references",
    "media",
    "reviews",
    "verifications",
    "quality_scores",
    "organization_members",
    "organizations",
    "subscriptions",
    "profiles",
    "users",
  ];

  for (const table of tables) {
    try {
      await seq.query(`TRUNCATE TABLE "${table}" CASCADE`);
    } catch {
      // Table may not exist yet — ignore
    }
  }
}

/**
 * Execute a callback inside a Sequelize transaction that is always rolled back.
 * Useful for wrapping individual test cases so they never commit data.
 */
export async function withRollback<T>(
  fn: (transaction: any) => Promise<T>,
  db?: Sequelize,
): Promise<T> {
  const seq = db ?? sequelize;
  const transaction = await seq.transaction();

  try {
    const result = await fn(transaction);
    return result;
  } finally {
    await transaction.rollback();
  }
}
