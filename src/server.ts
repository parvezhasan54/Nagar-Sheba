
import cron from "node-cron";
import config from "./app/config";
import { runRequestLifecycleJob } from "./app/jobs/requestLifecycle.job";
import { prisma } from "./app/lib/prisma";
import { redisClient } from "./app/lib/redis";

const PORT = config.port;

const runLifecycleJobSafely = async () => {
  try {
    await runRequestLifecycleJob();
  } catch (error) {
    console.error("Request lifecycle job failed:", error);
  }
};

const main = async () => {
  try {
    // 1. Connect to PostgreSQL
    await prisma.$connect();
    console.log("Connected to the database successfully.");

    // 2. Start Express without waiting for Redis
    const { default: app } = await import("./app");

    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });

    // 3. Connect to Redis independently
    redisClient
      .connect()
      .then(() => {
        console.log("Connected to Redis successfully.");
      })
      .catch((error) => {
        console.error("Redis connection failed:", error.message);
      });

    // 4. Start background jobs
    void runLifecycleJobSafely();

    cron.schedule("*/15 * * * *", () => {
      void runLifecycleJobSafely();
    });
  } catch (error) {
    console.error("Error starting the server:", error);

    if (redisClient.isOpen) {
      await redisClient.quit().catch(console.error);
    }

    await prisma.$disconnect().catch(console.error);

    process.exit(1);
  }
};

main();
