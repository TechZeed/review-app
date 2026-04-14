import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { initializeFirebase } from "./config/firebase.js";
import { initDb, shutdownDb } from "./config/sequelize.js";
import { app } from "./app.js";

async function main() {
  initializeFirebase();
  await initDb();

  // Migrations will be run here once the db/migrate module is implemented
  // const { migrateUp } = await import("./db/migrate.js");
  // await migrateUp();

  const port = env.PORT;
  const server = app.listen(port, "0.0.0.0", () => {
    logger.info(`server started on port ${port}`, { port });
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully`);
    server.close(async () => {
      logger.info("HTTP server closed");
      await shutdownDb();
      logger.info("Database connection closed");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("fatal startup error", { err });
  process.exit(1);
});
