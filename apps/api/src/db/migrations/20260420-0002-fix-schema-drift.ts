import type { Migration } from "../umzug.js";

// Spec 53 — patch missing columns/extensions/indexes that the repos write SQL
// for but no prior migration ever created. Additive only.

export const up: Migration = async ({ context: sequelize }) => {
  // 1. pg_trgm extension (for `p.location % :query` similarity operator)
  await sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  // 2-4. subscriptions: stripe_price_id, billing_cycle, quantity
  await sequelize.query(`
    ALTER TABLE subscriptions
      ADD COLUMN IF NOT EXISTS stripe_price_id varchar(255),
      ADD COLUMN IF NOT EXISTS billing_cycle   varchar(20),
      ADD COLUMN IF NOT EXISTS quantity        integer NOT NULL DEFAULT 1
  `);

  // 5. profiles.search_vector
  await sequelize.query(`ALTER TABLE profiles ADD COLUMN IF NOT EXISTS search_vector tsvector`);

  // 6. GIN index on search_vector
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS profiles_search_vector_idx
      ON profiles USING gin (search_vector)
  `);

  // 7. trigram GIN index on profiles.location
  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS profiles_location_trgm_idx
      ON profiles USING gin (location gin_trgm_ops)
  `);

  // 8. Backfill search_vector for existing rows
  await sequelize.query(`
    UPDATE profiles
    SET search_vector = to_tsvector(
      'english',
      coalesce(headline, '') || ' ' ||
      coalesce(bio, '')      || ' ' ||
      coalesce(industry, '') || ' ' ||
      coalesce(location, '')
    )
    WHERE search_vector IS NULL
  `);

  // 9. Trigger to keep search_vector in sync on INSERT/UPDATE
  await sequelize.query(`
    CREATE OR REPLACE FUNCTION profiles_search_vector_refresh()
    RETURNS trigger AS $$
    BEGIN
      NEW.search_vector := to_tsvector(
        'english',
        coalesce(NEW.headline, '') || ' ' ||
        coalesce(NEW.bio, '')      || ' ' ||
        coalesce(NEW.industry, '') || ' ' ||
        coalesce(NEW.location, '')
      );
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql
  `);

  await sequelize.query(`DROP TRIGGER IF EXISTS profiles_search_vector_trg ON profiles`);
  await sequelize.query(`
    CREATE TRIGGER profiles_search_vector_trg
      BEFORE INSERT OR UPDATE OF headline, bio, industry, location
      ON profiles
      FOR EACH ROW EXECUTE FUNCTION profiles_search_vector_refresh()
  `);
};

export const down: Migration = async ({ context: sequelize }) => {
  await sequelize.query(`DROP TRIGGER IF EXISTS profiles_search_vector_trg ON profiles`);
  await sequelize.query(`DROP FUNCTION IF EXISTS profiles_search_vector_refresh()`);
  await sequelize.query(`DROP INDEX IF EXISTS profiles_location_trgm_idx`);
  await sequelize.query(`DROP INDEX IF EXISTS profiles_search_vector_idx`);
  await sequelize.query(`ALTER TABLE profiles DROP COLUMN IF EXISTS search_vector`);
  await sequelize.query(`
    ALTER TABLE subscriptions
      DROP COLUMN IF EXISTS quantity,
      DROP COLUMN IF EXISTS billing_cycle,
      DROP COLUMN IF EXISTS stripe_price_id
  `);
  // pg_trgm: leave installed (other migrations may rely on it later)
};
