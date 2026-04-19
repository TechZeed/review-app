import type { Migration } from "../umzug.js";
import { DataTypes } from "sequelize";

// Adds a nullable test_run_id column to every table the regression suite
// mutates. Prod traffic writes NULL; spec 25 tests write a UUID and SQL-DELETE
// by that id in afterAll + nightly 24h sweep. Partial index keeps prod row
// cost at zero.

const TABLES = ["reviews", "review_tokens", "role_requests", "subscriptions", "review_media"] as const;

async function columnExists(queryInterface: any, table: string, column: string): Promise<boolean> {
  try {
    const desc = await queryInterface.describeTable(table);
    return column in desc;
  } catch {
    return false;
  }
}

export const up: Migration = async ({ context: sequelize }) => {
  const qi = sequelize.getQueryInterface();
  for (const table of TABLES) {
    if (!(await columnExists(qi, table, "test_run_id"))) {
      await qi.addColumn(table, "test_run_id", { type: DataTypes.UUID, allowNull: true });
    }
    const indexName = `${table}_test_run_id_idx`;
    try {
      await sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} (test_run_id) WHERE test_run_id IS NOT NULL`,
      );
    } catch (e: any) {
      if (!e.message?.includes("already exists")) throw e;
    }
  }
};

export const down: Migration = async ({ context: sequelize }) => {
  const qi = sequelize.getQueryInterface();
  for (const table of TABLES) {
    try {
      await sequelize.query(`DROP INDEX IF EXISTS ${table}_test_run_id_idx`);
    } catch {}
    if (await columnExists(qi, table, "test_run_id")) {
      await qi.removeColumn(table, "test_run_id");
    }
  }
};
