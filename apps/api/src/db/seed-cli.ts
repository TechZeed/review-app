import { initDb } from "../config/sequelize.js";
import { seedUp, seedDown } from "./seed.js";

const cmd = process.argv[2];

if (cmd === "up") {
  await initDb();
  await seedUp();
  process.exit(0);
}

if (cmd === "down") {
  await initDb();
  const to = process.argv[3];
  await seedDown(to);
  process.exit(0);
}

if (cmd === "status") {
  console.log("Seed status requires database initialization. Use 'up' or 'down' commands.");
  process.exit(1);
}

console.log("Usage: tsx src/db/seed-cli.ts <up|down|status> [to]");
process.exit(1);
