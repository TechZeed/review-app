import { logger } from "../config/logger.js";
import { migrator } from "./umzug.js";

export async function migrateUp() {
  try {
    const umzug = migrator;
    const pending = await umzug.pending();
    logger.info("migrations pending", { count: pending.length });

    if (pending.length === 0) {
      logger.info("No pending migrations");
      return;
    }

    const res = await umzug.up();
    logger.info("migrations applied", { count: res.length });
  } catch (error) {
    logger.error("Migration failed", { error });
    throw error;
  }
}

export async function migrateDown(to?: string) {
  const umzug = migrator;
  const res = await umzug.down(to ? { to } : undefined);
  logger.info("migrations rolled back", { count: res.length, to });
}
