import type { Migration } from "../umzug.js";

export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await sequelize.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query('DROP EXTENSION IF EXISTS "pgcrypto";');
  await sequelize.query('DROP EXTENSION IF EXISTS "uuid-ossp";');
};
