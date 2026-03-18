import { logger } from "../logger";
import repositoryFabric from "../infrastructure/repository/repositoryFabric";
import dateFabric from "../infrastructure/date/dateFabric";
import { makeSubscriptionPromise } from "../shared/types/service";
import { subscriptionCreateSchema } from "../infrastructure/schema/subscriptions.schema";

const subscriptionService = {
  createOrExtendSubscription: async function (
    userId: string,
    product: string,
    period?: string
  ): Promise<makeSubscriptionPromise> {
    try {
      const activeRows = await repositoryFabric.subscription.get(
        userId,
        product
      );

      if (activeRows.length > 0) {
        const row = activeRows[0];
        const { expires } = await dateFabric.startSubscribing(product, period);

        await repositoryFabric.subscription.update(expires, row);

        logger.info(
          { userId, product, oldExpires: row.expireAt, expires },
          "Extended subscription"
        );

        return { created: false, id: row.id, expires_at: expires };
      } else {
        const { expires, start } = await dateFabric.startSubscribing(product, period);

        const parsed = subscriptionCreateSchema.parse({
          userId,
          product,
          startAt: start,
          expireAt: expires,
        });

        const res = await repositoryFabric.subscription.create(parsed);

        logger.info({ userId, product, expires }, "Created new subscription");

        return { created: true, id: res[0].id, expires_at: expires };
      }
    } catch (err) {
      logger.error(
        { err, userId, product },
        "Error in createOrExtendSubscription"
      );
      throw err;
    }
  },

  getActiveSubscriptionInfo: async function (userId: string, product?: string) {
    try {
      const rows = await repositoryFabric.subscription.get(
        userId,
        product ?? product
      );

      if (!rows || rows.length === 0) return [];

      return rows.map((row) => {
        const { daysLeft, expiresAt } = dateFabric.getSubscribingLeft(
          row.expireAt
        );

        return {
          product: row.product,
          expiresAt,
          daysLeft,
          isActive: row.isActive,
        };
      });
    } catch (err) {
      logger.error({ err, userId }, "getActiveSubscriptionInfo failed");
      return [];
    }
  },

  findExpiringSoon: async function () {
    const { windowStart, windowEnd } = dateFabric.getExpiringSubscribeWindow();
    const rows = await repositoryFabric.subscription.getExpiringBetween(
      windowStart,
      windowEnd
    );

    return rows;
  },

  findExpired: async function () {
    const now = new Date();
    const rows = await repositoryFabric.subscription.getExpired(now);

    return rows;
  },

  expireSubscriptionRow: async function (id: number) {
    try {
      await repositoryFabric.subscription.updateExpired(id);
      logger.info({ id }, "Subscription expired/disabled");
    } catch (err) {
      logger.error({ err }, "Error when subscription expired/disabled");
    }
  },

  findExpiringSoonTest: async function () {
    const target = dateFabric.getExpiringSubscribeTest();
    const rows = await repositoryFabric.subscription.getExpired(target);
    return rows;
  },

  findExpiredTest: async function () {
    const now = new Date();
    const rows = await repositoryFabric.subscription.getExpired(now);
    return rows;
  },

  // for cron tests mode
  removeAllReserves: async function () {
    await repositoryFabric.subscription.deleteAll();
    await repositoryFabric.payment.deleteAll();
  },
};

export default subscriptionService;
