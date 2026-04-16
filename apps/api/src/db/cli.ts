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
  try {
    await initDb();
    const { migrator } = await import("./umzug.js");
    const pending = await migrator.pending();
    const executed = await migrator.executed();
    console.log(`Executed: ${executed.length}`);
    executed.forEach((m) => console.log(`  ✓ ${m.name}`));
    console.log(`Pending: ${pending.length}`);
    pending.forEach((m) => console.log(`  ○ ${m.name}`));
    process.exit(0);
  } catch (error) {
    console.error("Status check failed:", error);
    process.exit(1);
  }
}

console.log("Usage: tsx src/db/cli.ts <up|down|status> [to]");
process.exit(1);
