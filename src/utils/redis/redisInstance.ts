import Redis from "ioredis";
import { config } from "../../config";
import { logger } from "../../logger";

const redis = new Redis(config.redisUrl);

const redisCtx = new Redis(config.redisUrl, { keyPrefix: "ctx:grammy:" });

redis.on("connect", () => logger.info("Redis connected"));
redis.on("error", (err) => logger.error({ err }, "Redis error"));

function redisStatus() {
  if (!redis.status || redis.status !== "ready") {
    logger.error("Redis not ready, cannot ping");
    return false;
  } else {
    return true;
  }
}

export { redis, redisCtx, redisStatus };
