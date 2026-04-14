import path from "node:path";
import { fileURLToPath } from "node:url";
import { Umzug, SequelizeStorage } from "umzug";
import { getSequelize } from "../config/sequelize.js";
import { logger } from "../config/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let _seedUmzug: Umzug | null = null;

function getSeedUmzug(): Umzug {
  if (!_seedUmzug) {
    const sequelize = getSequelize();

    _seedUmzug = new Umzug({
      migrations: {
        glob: path.join(__dirname, "seeds", "*.ts"),
      },
      context: sequelize,
      storage: new SequelizeStorage({
        sequelize,
        tableName: "SequelizeSeeds",
      }),
      logger: {
        info: (msg) => logger.info(msg),
        warn: (msg) => logger.warn(msg),
        error: (msg) => logger.error(msg),
        debug: (msg) => logger.debug(msg),
      },
    });
  }
  return _seedUmzug;
}

export async function seedUp() {
  const seedUmzug = getSeedUmzug();
  const pending = await seedUmzug.pending();
  logger.info("seeds pending", { count: pending.length });
  const res = await seedUmzug.up();
  logger.info("seeds applied", { count: res.length });
}

export async function seedDown(to?: string) {
  const seedUmzug = getSeedUmzug();
  const res = await seedUmzug.down(to ? { to } : undefined);
  logger.info("seeds rolled back", { count: res.length, to });
}
