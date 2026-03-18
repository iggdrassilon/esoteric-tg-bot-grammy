import cron from "node-cron";
import { logger } from "./logger";
import { bot } from "./bot";
import subscriptionService from "./services/subscriptionService";
import dateFabric from "./infrastructure/date/dateFabric";
import accessService from "./services/inviteService";
import healthService from "./services/healthService";
import { production } from "./shared/constants/production";

export function startCron() {
  logger.info("Starting cron jobs...");
  cron.schedule("0 0 * * *", async () => {
    logger.info("Cron tick — checking for expiring and expired subscriptions");
    // healthService.run(bot);
    try {
      const expiring = await subscriptionService.findExpiringSoon();

      for (const row of expiring) {
        const { daysLeft } = dateFabric.getSubscribingLeft(row.expireAt);

        try {
          const message = await bot.api.sendMessage(
            Number(row.userId),
            `Осталось ${daysLeft} дней и ваша подписка на ${production.channel} истечет. Можете продлить через /start -> Доступ в закрытый канал.`
          );
          logger.warn(
            { 
              user: row.userId, 
              daysLeft: daysLeft,
              message: message,
              chatId: message.chat.id
            },
            "Notified user about expiring subscription"
          );
        } catch (err) {
          logger.fatal({
            error: err,
            user: row.userId,
            expided_row: row,
          }, "Failed to notify user about subscription will be expired");
        }
      }
      const expired = await subscriptionService.findExpired();

      for (const row of expired) {
        try {
          const message = await bot.api.sendMessage(
            Number(row.userId),
            `Ваша подписка на ${production.channel} истекла. Доступ был отозван.`
          );

          const remove = await accessService.removeFromChannel(bot, Number(row.userId));
          const subscription = await subscriptionService.expireSubscriptionRow(row.id);

          logger.warn({
            user: row.userId,
            message: message,
            removeStatus: remove,
            subscrStatus: subscription,
          }, "Expired subscription processed");
        } catch (err) {
          logger.fatal({
            error: err,
            user: row.userId,
            expided_row: row,
          },
          "Failed to remove expired subscription");
        }
      }
    } catch (err) {
      logger.error({ err }, "cron: check failed");
    }
  });
}

export function startTestCron() {
  // logger.info("Starting test cron jobs (1-minute notifications)...");
  cron.schedule("* * * * *", async () => {
    // logger.info("Test cron tick — checking for expiring and expired subscriptions");

    try {
      healthService.run(bot);
      // const expiring = await subscriptionService.findExpiringSoonTest();

      // for (const row of expiring) {
      //   const minutesLeft = dateFabric.getSubscribingLeftTest(row.expireAt);

      //   try {
      //     if (minutesLeft !== 0) {
      //       await bot.api.sendMessage(
      //         Number(row.userId),
      //         `Осталось ${minutesLeft} дней и ваша подписка на ${production.channel} истечет. Можете продлить через /start -> Доступ в закрытый канал.`
      //       );
      //     }
      //     logger.info({ user: row.userId, minutesLeft }, "Test: Notified user");
      //   } catch (err) {
      //     logger.warn({ err, user: row.userId }, "Test: Failed to notify user");
      //   }
      // }

      // const expired = await subscriptionService.findExpiredTest();

      // for (const row of expired) {
      //   try {
      //     await bot.api.sendMessage(
      //       Number(row.userId),
      //       `Ваша подписка на ${production.channel} истекла. Доступ был отозван.`
      //     );
      //     await accessService.removeFromChannel(bot, Number(row.userId));
      //     await subscriptionService.expireSubscriptionRow(row.id);
      //     logger.info({ user: row.userId }, "Test: Expired subscription processed");
      //   } catch (err) {
      //     logger.error({ err, row }, "Test: Failed to expire subscription");
      //   }
      // }
      // await subscriptionService.removeAllReserves();
    } catch (err) {
      logger.error({ err }, "Test cron: check failed");
    }
  });
}

// ┌───────────── секунда (0–59)
// │ ┌─────────── минута (0–59)
// │ │ ┌───────── час (0–23)
// │ │ │ ┌─────── день месяца (1–31)
// │ │ │ │ ┌───── месяц (1–12)
// │ │ │ │ │ ┌─── день недели (0–7)
// * * * * * *
