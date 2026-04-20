import type { Migration } from "../umzug.js";

// Spec 53 follow-up — second pass after first migration uncovered two more
// missing columns the subscription repo SELECTs and RETURNs.

export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS cancelled_at         timestamptz
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`
    ALTER TABLE subscriptions
      DROP COLUMN IF EXISTS cancelled_at,
      DROP COLUMN IF EXISTS cancel_at_period_end
  `);
};
