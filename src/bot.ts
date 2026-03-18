import { Bot, session as grammySession } from "grammy";
import { logger } from "./logger";
import { config } from "./config";
import { redisCtx } from "./utils/redis/redisInstance";
import { RedisAdapter } from "@grammyjs/storage-redis";
import menuHandler from "./handlers/menuHandler";
import mediaHandler from "./handlers/mediaHandler";
import adminHandler from "./handlers/adminHandler";
import subscriptionService from "./services/subscriptionService";
import metricsHandler from "./handlers/metricsHandler";
import { CTXGrammy } from "./shared/types/bot";
import supportHandler from "./handlers/supportHandler";
import { messageHandler } from "./handlers/messageHandler";
import inviteHandler from "./handlers/inviteHandler";
import grammyMiddleware from "./middleware/grammyMiddleware";
import messageGuard from "./middleware/messageMiddleware";

export const bot = new Bot<CTXGrammy>(config.botToken);

bot.use(async (ctx, next) => {
  logger.info({ 
    update: ctx.update.update_id,
    object: ctx.update.callback_query?.message?.from,
    user: ctx.update.callback_query?.from,
    text: ctx.update.callback_query?.message?.text,
  },
  "incoming update from");
  try {
    await grammyMiddleware(ctx, next);
  } catch (err) {
    logger.error({ err }, "Unhandled handler error");
  }
});

bot.use(
  grammySession({
    initial: () => ({}),
    storage: new RedisAdapter({
      instance: redisCtx,
      ttl: 60 * 60 * 24 * 7,
    }),
  })
);

bot.use((ctx, next) => {
  if (ctx.chat?.type === "group" || ctx.chat?.type === "supergroup") {
    if (ctx.message?.text?.startsWith("/")) {
      return;
    }
  }
  return next();
});

// bot.callbackQuery(/.*/, async (ctx) => {
//   await messageSessionMiddleware(ctx)
// });

bot.command("start", async (ctx) => menuHandler.handleRoot(ctx, true));

bot.on("message:text", async (ctx) => {
  await adminHandler.answeredSupportHandler(ctx);
  await messageHandler.redirectToSupport(ctx);
  await inviteHandler.handleInviteMenu(ctx);
  logger.warn({
    chatId: ctx.chat?.id,
    userId: ctx.from?.username,
    userFirst: ctx.from?.first_name,
    userLastName: ctx.from?.last_name,
    message: ctx.message?.text,
  }, 'User send message to bot')
});

bot.on("message:photo", async (ctx) => {
  await mediaHandler.handlePhoto(ctx);
});

bot.on("message:document", async (ctx) => {
  mediaHandler.handleDocument(ctx);
});

bot.on("chat_join_request", async (ctx) => {
  try {
    const userId = ctx.chatJoinRequest.from.id;
    const chatId = ctx.chatJoinRequest.chat.id;

    const userSubscription =
      await subscriptionService.getActiveSubscriptionInfo(String(userId));

    const hasAccess = userSubscription.some(
      (sub) => sub.isActive === true && sub.product === "channel"
    );

    if (hasAccess) {
      await bot.api.approveChatJoinRequest(chatId, userId);
      logger.info({ userId, chatId }, "Join request approved");
    } else {
      await bot.api.declineChatJoinRequest(chatId, userId);
      logger.info({ userId, chatId }, "Join request declined");
    }
  } catch (err) {
    logger.error({ err }, "Error handling join request");
  }
});

bot.callbackQuery(
  /^metrics:(all|course|channel)$/,
  metricsHandler.handleMetrics
);

bot.callbackQuery('menu:start', messageGuard(async (ctx) => {
  logger.info({ chatMember: ctx.chatMember }, 'Entering menu');
  await menuHandler.handleRoot(ctx, true);
  await ctx.answerCallbackQuery();
}));

bot.callbackQuery("menu:admin:metrics", async (ctx) => {
  const userId = ctx.callbackQuery.from.id;
  const admin = config.adminChatId;

  if (userId === Number(admin)) await menuHandler.handleMetricsMenu(ctx);
});

bot.callbackQuery(/menu:tariffs/, async (ctx) => {
  await menuHandler.handleTariffs(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^tariff:(.+)$/, async (ctx) => {
  const match = ctx.callbackQuery.data?.match(/^tariff:(.+)$/);
  if (match) {
    const choice = match[1] as "course" | "channel" | "public";
    // @ts-ignore
    ctx.session.pendingProduct = choice;
    await menuHandler.handleTariffChoice(ctx, choice, true);
    await ctx.answerCallbackQuery();
  }
});

bot.callbackQuery("menu:subscription", async (ctx) => {
  await menuHandler.handleMySubscription(ctx);
  await ctx.answerCallbackQuery();
});

bot.callbackQuery("menu:admin", async (ctx) => {
  await menuHandler.handleAdminMenu(ctx);
});

bot.callbackQuery("menu:admin:invite", async (ctx) => {
  await inviteHandler.handleInvite(ctx);
});

bot.callbackQuery(/^invite:/, async (ctx) => {
  await inviteHandler.handleInvite(ctx);
});

bot.callbackQuery(/menu:support(:.*)?/, async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data === "menu:support:course") {
    await menuHandler.handleMySupport(ctx, "course");
  } else {
    await menuHandler.handleMySupport(ctx, "root");
  }

  await ctx.answerCallbackQuery();
});

bot.callbackQuery(/^support:(payment|channel|course|just)$/, async (ctx) => {
  const match = ctx.callbackQuery.data?.split(":")[1];
  if (match) await supportHandler.handleSupport(ctx, match);
});

bot.callbackQuery(/^admin:/, async (ctx) => {
  const [, action] = ctx.callbackQuery.data.split(":");

  if (action === "approve") {
    await adminHandler.approveSubscribeHandler(ctx);
  }

  if (action === "answer") {
    await adminHandler.answerSupportHandler(ctx);
  }
});

bot.callbackQuery(/^requisites:/, messageGuard(async (ctx) => {
  const data = ctx.callbackQuery?.data;
  const matchStandart = data?.match(/^requisites:(course|channel)$/);
  const matchReserve = data?.match(/^requisites:course:reserve/);
  const complete = data?.match(/^requisites:course:reserve:complete$/);

  if (matchStandart) {
    const choice = matchStandart[1] as "course" | "channel";
    await menuHandler.handleRequisites(ctx, choice);
    await ctx.answerCallbackQuery();
  }

  if (matchReserve) {
    const isComplete = complete ? true : false;
    await menuHandler.handleTariffs(ctx);
    await ctx.answerCallbackQuery({
      text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
      show_alert: true
    });
    if (isComplete) {
      await menuHandler.handleTariffs(ctx);
      await ctx.answerCallbackQuery({
        text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
        show_alert: true
      });
    }
  }

  //   await menuHandler.handleRequisites(ctx, "course", "reserve", isComplete);
  //   await ctx.answerCallbackQuery();
  // }

  // if (ctx.callbackQuery.data.endsWith("special")) {
  //   await menuHandler.handleRequisites(ctx, "course", "special");
  //   await ctx.answerCallbackQuery();
  // }
}));

bot.callbackQuery(/^paid:/, messageGuard(async (ctx) => {
  const data = ctx.callbackQuery?.data?.split(':');
  if (!data) return;
  const choice = data[1] as "course" | "channel";
  const hasReserve = data[2] === "reserve" ? true : false;
  const isSpecial = data[2] === "special" ? true : false;
  const isComplete = !!data[3];
  
  if (!hasReserve && !isSpecial) {
    await menuHandler.handlePaidPressed(ctx, {
      choice: choice,
    });
  } else if (hasReserve && !isComplete) {
    await menuHandler.handleTariffs(ctx);
    await ctx.answerCallbackQuery({
      text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
      show_alert: true
    });
    // await menuHandler.handlePaidPressed(ctx, {
    //   choice: "course",
    //   isReserve: true,
    // });
  } else if (isComplete) {
    await menuHandler.handleTariffs(ctx);
    await ctx.answerCallbackQuery({
      text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
      show_alert: true
    });
    // await menuHandler.handlePaidPressed(ctx, {
    //   choice: "course",
    //   isCompleteReserve: true,
    // });
  } else if (isSpecial) {
    await menuHandler.handleTariffs(ctx);
    await ctx.answerCallbackQuery({
      text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
      show_alert: true
    });
    // await menuHandler.handlePaidPressed(ctx, {
    //   choice: "course",
    //   isSpecial: true,
    // });
  }
}));

bot.callbackQuery(/^back:(.+)$/, async (ctx) => {
  const data = ctx.callbackQuery.data || "";
  const match = data.match(/^back:(.+)$/);

  if (!match) {
    await ctx.answerCallbackQuery();
    return;
  }

  const target = match[1];

  try {
    switch (true) {
      case target === "root":
        await menuHandler.handleRoot(ctx);
        break;

      case target === "tariffs":
        await menuHandler.handleTariffs(ctx);
        break;

      case target.startsWith("product:"):
        {
          const [, choice] = target.split(":");
          await menuHandler.handleTariffChoice(
            ctx,
            choice as "course" | "channel",
            true
          );
        }
        break;
      case target === "course":
        await menuHandler.handleTariffChoice(ctx, "course", true);
        break;
      case target.startsWith("requisites:"):
        {
          const [, choice, status, isComplete] = target.split(":");
          await menuHandler.handleRequisites(
            ctx,
            choice as "course" | "channel",
            status === "reserve"
              ? isComplete
                ? undefined
                : "reserve"
              : "special",
            isComplete ? true : false
          );
        }
        break;

      case target.startsWith("menu:"):
        {
          if (target === "menu:admin") {
            await menuHandler.handleAdminMenu(ctx);
          }
          if (target === "menu:admin:metrics") {
            await menuHandler.handleMetricsMenu(ctx);
          }
          if (target === "menu:admin:invite") {
            await inviteHandler.handleInvite(ctx);
          }
        }
        break;

      case target.startsWith("support:"):
        {
          const backContext = data[1];
          await menuHandler.handleMySupport(ctx, backContext);
        }
        break;

      default:
        await menuHandler.handleRoot(ctx);
        break;
    }

    await ctx.answerCallbackQuery();
  } catch (err) {
    console.error(err);
    try {
      await ctx.answerCallbackQuery();
    } catch {}
  }
});

export async function startBot() {
  logger.info("Starting bot (long polling)...");
  await bot.init();

  // await bot.api.setMyCommands([], {
  //   scope: { type: "all_group_chats" },
  // });

  bot.start();
  logger.info("Bot started");
}
