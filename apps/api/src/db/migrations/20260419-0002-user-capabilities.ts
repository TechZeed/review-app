import type { Migration } from "../umzug.js";

// Spec 28 — Capability-based access. Introduces user_capabilities so paid
// features can be gated by entitlement (orthogonal to role). A user may hold
// multiple capabilities concurrently (employer + recruiter), each tied to an
// active subscription or an admin grant.

async function tableExists(sequelize: any, name: string): Promise<boolean> {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables WHERE table_name = :name LIMIT 1`,
    { replacements: { name } },
  );
  return Array.isArray(rows) && rows.length > 0;
}

export const up: Migration = async ({ context: sequelize }) => {
  if (!(await tableExists(sequelize, "user_capabilities"))) {
    await sequelize.query(`
      CREATE TABLE user_capabilities (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        capability      VARCHAR(32) NOT NULL,
        source          VARCHAR(32) NOT NULL,
        subscription_id UUID NULL REFERENCES subscriptions(id) ON DELETE SET NULL,
        granted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at      TIMESTAMPTZ NULL,
        metadata        JSONB NULL,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
  }

  // Postgres rejects NOW() in partial-index predicates (not IMMUTABLE).
  // A plain composite index on (user_id, capability, expires_at) covers the
  // hot `isActive` lookup well enough — planner can use it for equality on
  // the first two cols and range filter on expires_at. Cheap on rows.
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_user_capabilities_user_active
      ON user_capabilities (user_id, capability, expires_at);
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`DROP INDEX IF EXISTS idx_user_capabilities_user_active`);
  await sequelize.query(`DROP TABLE IF EXISTS user_capabilities`);
};
