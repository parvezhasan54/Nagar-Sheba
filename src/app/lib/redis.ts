
import { createClient } from "redis";
import config from "../config";

export const redisClient = createClient({
  username: config.redis.username,
  password: config.redis.password,
  socket: {
    host: config.redis.host,
    port: config.redis.port,

    reconnectStrategy: (retries) => {
      if (retries > 10) {
        return new Error("Redis reconnect limit reached");
      }

      return Math.min(retries * 200, 3000);
    },
  },
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err.message);
});

redisClient.on("connect", () => {
  console.log("Connecting to Redis...");
});

redisClient.on("ready", () => {
  console.log("Redis connected successfully!");
});

redisClient.on("reconnecting", () => {
  console.log("Redis reconnecting...");
});
