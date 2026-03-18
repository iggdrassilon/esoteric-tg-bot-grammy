import { Bot, Context, InlineKeyboard } from "grammy";
import { logger } from "../logger";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import { CTXGrammy } from "../shared/types/bot";
import { randomUUID } from "crypto";
import { keys } from "../shared/constants/keyboard";
import { redis } from "../utils/redis/redisInstance";
import { config } from "../config";
import { format } from "date-fns";
import parser from "../utils/parsers/parsersModule";

const adminUserId = Number(config.adminChatId);

const messageHandler = {
  editOrSend: async function (
    ctx: Context,
    text: string,
    keyboard?: InlineKeyboard,
    state?: string | null,
    forceSend = false,
  ) {
    const chatId = ctx.chat!.id as number;
    let message;
    let setSession;

    if (!forceSend) {
      const session = await redisFabric.getMessageSession(chatId);

      if (session?.message_id && session?.state !== "support_request") {
        try {
          message = await ctx.api.editMessageText(
            chatId,
            Number(session.message_id),
            text,
            {
              reply_markup: keyboard,
            },
          );
          logger.info({ chatId }, "Message edit completed.");
          session.state = state ?? session.state ?? "root";
          setSession = await redisFabric.setMessageSession(chatId, session);

          if (message !== true) {
            logger.warn(
              {
                chatId,
                message: {
                  chat: message.chat,
                  text: message.text,
                },
                session: setSession,
                isForce: forceSend,
              },
              "Edit or send message complete.",
            );
          }
          return;
        } catch (err) {
          logger.fatal(
            {
              error: err,
            },
            "editOrSend message failed, falling back to send",
          );
        }
      }
    }

    message = await ctx.reply(text, {
      reply_markup: keyboard,
      parse_mode: "HTML",
    });

    setSession = await redisFabric.setMessageSession(chatId, {
      message_id: message.message_id,
      state: state ?? "root",
    });

    logger.warn(
      {
        chatId: chatId,
        message: {
          chat: message.chat,
          text: message.text,
        },
        session: setSession,
        isForse: forceSend,
      },
      `Edit or send message complete.`,
    );
  },

  updateOrCreateMessage: async function (
    bot: Bot<CTXGrammy>,
    chatId: number,
    text: string,
  ) {
    try {
      const prev = await redisFabric.getHealthCheck(chatId);
      if (prev && !prev?.messageId) {
        const msg = await bot.api.sendMessage(chatId, text, {
          parse_mode: "HTML",
        });

        return { ok: true, messageId: msg.message_id };
      }

      await bot.api.editMessageText(chatId, Number(prev?.messageId), text, {
        parse_mode: "HTML",
      });

      // logger.info({ messageId: prev?.messageId }, "Health Message updated");
      return { ok: true, messageId: prev?.messageId };
    } catch (err: any) {
      const errorText = err?.description || err?.message || "";
      console.log(errorText);
      if (
        errorText.includes("chat not found") ||
        errorText.includes("message to edit not found") ||
        errorText.includes("message can't be edited") ||
        errorText.includes("bot was blocked") ||
        errorText.includes("USER_IS_BLOCKED") ||
        errorText.includes("MESSAGE_ID_INVALID")
      ) {
        logger.warn("Message not found, recreating…");

        const msg = await bot.api.sendMessage(chatId, text, {
          parse_mode: "HTML",
        });

        return { ok: true, messageId: msg.message_id };
      }

      if (err?.description?.includes("Watcher removed the chat")) {
        logger.error("Watcher removed the chat or blocked the bot.");
        return { ok: false, messageId: null, blocked: true };
      }

      logger.error({ err }, "Failed to update/create health msg");
      return { ok: false, messageId: null };
    }
  },

  redirectToSupport: async function (ctx: CTXGrammy) {
    const userId = ctx.from?.id;
    const chatId = ctx.chatId;
    const userName = ctx.from?.username;
    const text = ctx.message?.text;

    if (!userId) {
      logger.error("chat handler can't find userId");
      return;
    }

    const context = await redisFabric.getMessageSession(userId);

    if (!context) {
      logger.error("messageSession on chatHandler can't found.");
      return;
    }

    const state = context.state as string;
    const [stage, reason, status] = state.split("_");

    if (!(stage === "support" && status === "ask")) return;

    if (chatId) ctx.api.sendChatAction(chatId, "typing");

    // function checkReason(r: string) {
    //   switch (r) {
    //     case "payment":
    //       return "Вопрос по оплате";
    //     case "course":
    //       return "Вопрос по курсу";
    //     case "channel":
    //       return "Вопрос по каналу";
    //     default:
    //       return "Вопрос";
    //   }
    // }

    const ticketId = randomUUID();

    await redis.set(
      `support:ticket:${ticketId}`,
      JSON.stringify({
        ticketId,
        userId,
        userName,
        reason,
        message: text,
        status: "open",
        date: format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSSXXX"),
      }),
    );

    // const cause = checkReason(reason);

    const forwardedText =
      `Обращение в поддержку.\n\n` +
      `Пользователь:\n` +
      `   userId: ${
        userName !== undefined ? `@${userName}` : "Никнейм не указан"
      }\n` +
      `   Имя: ${parser.cleanString(ctx.from?.first_name)}\n` +
      `   Фамилия: ${parser.cleanString(ctx.from?.last_name)}\n\n` +
      // `По причине: ${cause}\n` +
      `Сообщение: ${text}`;

    const answeredText =
      "Ваше обращение в поддержку доставлено.\n" +
      "В ближайшее время с вами свяжется администратор.";

    const keysToUser = new InlineKeyboard().text(
      keys.backKey,
      `back:support:${reason}`,
    );

    const keysToAdmin = new InlineKeyboard().text(
      "Ответить",
      `admin:answer:${ticketId}`,
    );

    const message = await ctx.api.sendMessage(adminUserId, forwardedText, {
      reply_markup: keysToAdmin,
      parse_mode: "HTML",
    });

    const redisOperation = await redisFabric.setMessageSession(adminUserId, {
      message_id: message.message_id,
      state: "support_request",
    });

    const messageComplete = await this.editOrSend(
      ctx,
      answeredText,
      keysToUser,
      `${stage}_${reason}_completed`,
      true,
    );

    logger.warn(
      {
        adminUserId: adminUserId,
        ticketId: ticketId,
        redis: redisOperation,
        messageId: message.message_id,
        messageComplete: messageComplete,
      },
      "Support request created by user.",
    );
  },
};

export { messageHandler };
