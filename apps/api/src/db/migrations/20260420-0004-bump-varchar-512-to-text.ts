import type { Migration } from "../umzug.js";

// Bump varchar(512) columns that hold third-party URLs (Google profile pictures,
// signed cloud-storage URLs) to TEXT. Google profile picture URLs from
// `lh3.googleusercontent.com` regularly exceed 512 chars once size/quality
// params are appended, causing 500 ("value too long for type character
// varying(512)") on Google sign-in.

export const up: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`ALTER TABLE users         ALTER COLUMN avatar_url   TYPE text`);
  await sequelize.query(`ALTER TABLE profiles      ALTER COLUMN qr_code_url  TYPE text`);
  await sequelize.query(`ALTER TABLE review_media  ALTER COLUMN media_url    TYPE text`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN logo_url     TYPE text`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN website      TYPE text`);
};

export const down: Migration = async ({ context: sequelize }) => {
  // Note: down requires every existing value to fit in 512 chars; will fail
  // if any post-migration value exceeds that. Acceptable for a recoverable
  // rollback during local dev.
  await sequelize.query(`ALTER TABLE users         ALTER COLUMN avatar_url   TYPE varchar(512)`);
  await sequelize.query(`ALTER TABLE profiles      ALTER COLUMN qr_code_url  TYPE varchar(512)`);
  await sequelize.query(`ALTER TABLE review_media  ALTER COLUMN media_url    TYPE varchar(512)`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN logo_url     TYPE varchar(512)`);
  await sequelize.query(`ALTER TABLE organizations ALTER COLUMN website      TYPE varchar(512)`);
};
