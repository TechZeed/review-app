import path from "node:path";
import { fileURLToPath } from "node:url";
import { Umzug, SequelizeStorage } from "umzug";
import type { Sequelize } from "sequelize";
import { getSequelize, initDb } from "../config/sequelize.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type Migration = (params: { context: Sequelize; name: string; path?: string }) => Promise<unknown>;

await initDb();
const sequelize = getSequelize();

export const migrator = new Umzug<Sequelize>({
  migrations: {
    glob: ["migrations/*.ts", { cwd: __dirname }],
  },
  context: sequelize,
  storage: new SequelizeStorage({ sequelize }),
  logger: undefined,
});
