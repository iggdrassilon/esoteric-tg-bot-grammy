import { Bot } from "grammy";
import { config } from "../config";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import repositoryFabric from "../infrastructure/repository/repositoryFabric";
import { logger } from "../logger";
import { CTXGrammy } from "../shared/types/bot";
import { format } from "date-fns";
import ru from "date-fns/locale/ru";
import { messageHandler } from "../handlers/messageHandler";

const healthService = {
  async checkDatabase() {
    try {
      return await repositoryFabric.health.check();
    } catch (err) {
      logger.error({ err }, "DB health check failed");
      return false;
    }
  },

  async checkRedis() {
    try {
      return await redisFabric.ping();
    } catch (err) {
      logger.error({ err }, "Redis health check failed");
      return false;
    }
  },

  async run(bot: Bot<CTXGrammy>) {
    const chatId = Number(config.watcher);
    const now = new Date();
    const date = format(now, "HH:mm:ss, dd MMMM", { locale: ru });

    const [redisOk] = await Promise.allSettled([
      // this.checkDatabase(),
      this.checkRedis()
    ]);

    const text = [
      `${date}`,
      `<b>⚙️ Бот жив</b>`,
      // `<b>Redis:</b> ${redisOk ? "OK" : "❌"}`,
      // `<b>БД:</b> ${dbOk ? "OK" : "❌"}`,
      ``,
    ].join("\n");

    const res = await messageHandler.updateOrCreateMessage(bot, chatId, text);

    const state = {
      messageId: res?.messageId,
      // dbOk,
      redisOk,
      lastCheck: date,
    };
    if (redisOk) {
      try {
        if (res.ok) {
          await redisFabric.setHealthCheck(chatId, state);
        } else if (res.blocked) {
          await redisFabric.setHealthCheck(chatId, null);
        }
      } catch (err) {
        logger.error({ err }, "Failed to send/update health msg");
      }
    }

    // logger.info({
    //   // dbOk,
    //   redisOk,
    //   time: date
    // }, "Health check completed");
  }
};

export default healthService;
