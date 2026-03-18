import { logger } from "../../logger";
import { redis, redisStatus } from "../../utils/redis/redisInstance";

const ttl = 60 * 60 * 24 * 7;

const MSG_KEY = (chatId: number) => `msg_session:${chatId}`;
const USER_CACHE = (userId: number) => `user_cache:${userId}`;
const PAYMENT_KEY = (userId: number) => `payment:${userId}`;
const HEALTH_CHECKER = (chatId: number) => `health:${chatId}`;

const redisFabric = {
  getMessageSession: async function (
    chatId: number
  ): Promise<{ [key: string]: string | number } | null> {
    logger.info(`redis get messageSession for ${chatId}`);
    const raw = await redis.get(MSG_KEY(chatId));
    logger.info(`messageSession is ${raw}`);
    return raw ? JSON.parse(raw) : null;
  },

  setMessageSession: async function (chatId: number, payload: any) {
    logger.info(`redis set messageSession for ${chatId}`);
    const set = await redis.set(MSG_KEY(chatId), JSON.stringify(payload), "EX", ttl);
    logger.info(`messageSession is ${JSON.stringify(payload, null, 2)}`);
    return {
      status: set,
      chatId: chatId,
      payload: payload,
      ttl: ttl,
    };
  },

  updateMessageSession: async function (
    chatId: number,
    updates: { [key: string]: string | number }
  ): Promise<{ [key: string]: string | number }> {
    const session = (await this.getMessageSession(chatId)) || {};
    const newSession = { ...session, ...updates };
    await this.setMessageSession(chatId, newSession);

    return newSession;
  },

  setPaymentSession: async function (
    userId: number,
    payload: { [key: string]: string | number }
  ) {
    await redis.set(PAYMENT_KEY(userId), JSON.stringify(payload), "EX", ttl);
  },

  getPaymentSession: async function (userId: number) {
    const raw = await redis.get(PAYMENT_KEY(userId));
    return raw ? JSON.parse(raw) : null;
  },

  delMessageSession: async function (chatId: number) {
    await redis.del(MSG_KEY(chatId));
  },

  cacheUser: async function (userId: number, data: any, ttlSec = 3600) {
    await redis.set(USER_CACHE(userId), JSON.stringify(data), "EX", ttlSec);
  },

  getCachedUser: async function (userId: number) {
    const v = await redis.get(USER_CACHE(userId));
    return v ? JSON.parse(v) : null;
  },

  getHealthCheck: async function (
    chatId: number
  ): Promise<{ [key: string]: string } | null> {
    if (redisStatus()) {
      try {
        const v = await redis.get(HEALTH_CHECKER(chatId));
        return v ? JSON.parse(v) : null;
      } catch (err) {
        logger.error({ err }, "getHealthCheck failed");
        return null;
      }
    } else {
      return null;
    }
  },

  setHealthCheck: async function (chatId: number, data: any) {
    await redis.set(HEALTH_CHECKER(chatId), JSON.stringify(data), "EX", ttl);
  },

  ping: async function () {
    const status = redisStatus();
    if (!status) {
      return false;
    }
    try {
      const ping = await redis.ping();
      return ping;
    } catch (err) {
      logger.error({ err }, "Redis ping failed");
      return false;
    }
  },
};

export { redisFabric };
