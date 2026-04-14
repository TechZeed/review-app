import { logger } from "./config/logger.js";
import { resolveAllSecrets } from "./config/configResolver.js";

async function main() {
  // 1. Resolve secrets: env vars first, GCP Secret Manager fallback
  await resolveAllSecrets();

  // 2. Now import env (Zod parse happens on import — secrets must be resolved first)
  const { env } = await import("./config/env.js");
  const { initializeFirebase } = await import("./config/firebase.js");
  const { initDb, shutdownDb } = await import("./config/sequelize.js");
  const { app } = await import("./app.js");

  // 3. Initialize services
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
