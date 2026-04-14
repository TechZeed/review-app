import { initDb } from "../config/sequelize.js";
import { migrateUp, migrateDown } from "./migrate.js";

const cmd = process.argv[2];

if (cmd === "up") {
  try {
    await initDb();
    await migrateUp();
    console.log("Migrations completed successfully");
    process.exit(0);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

if (cmd === "down") {
  try {
    await initDb();
    const to = process.argv[3];
    await migrateDown(to);
    console.log("Migration rollback completed");
    process.exit(0);
  } catch (error) {
    console.error("Migration rollback failed:", error);
    process.exit(1);
  }
}

if (cmd === "status") {
  console.log("Migration status requires database initialization. Use 'up' or 'down' commands.");
  process.exit(1);
}

console.log("Usage: tsx src/db/cli.ts <up|down|status> [to]");
process.exit(1);
