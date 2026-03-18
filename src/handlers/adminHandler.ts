import { Context } from "grammy";
import { logger } from "../logger";
// import { deleteFile } from "../utils/fileStore";
import { config } from "../config";
import { bot } from "../bot";
import { payloadSchema } from "./dto/dto";
import subscriptionService from "../services/subscriptionService";
import paymentService from "../services/paymentService";
import accessService from "../services/inviteService";
import prices from "../shared/constants/tariffs";
import { production } from "../shared/constants/production";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import { PaymentPromiseSchema } from "../infrastructure/schema/payment.schema";
import { redis } from "../utils/redis/redisInstance";
import { SessionContext } from "../shared/types/context";
import { keyboard } from "../shared/constants/keyboard";
import userService from "../services/usersService";
import parser from "../utils/parsers/parsersModule";

const adminUserId = Number(config.adminChatId);

const adminHandler = {
  answerSupportHandler: async function (ctx: Context) {
    if (!ctx.callbackQuery?.data) return;
    if (!ctx.from) return;

    const userId = ctx.from.id;
    const [, , ticketId] = ctx.callbackQuery.data.split(":");

    if (!ticketId) return;

    const raw = await redis.get(`support:ticket:${ticketId}`);

    if (!raw) {
      await ctx.answerCallbackQuery({
        text: "❗ Этот тикет не найден.",
        show_alert: true,
      });
      return;
    }

    const ticket = JSON.parse(raw);

    if (ticket.status === "answered") {
      await ctx.answerCallbackQuery({
        text: "❗ Этот тикет уже недоступен.",
        show_alert: true,
      });
      return;
    }

    const text = `Введите ваш ответ пользователю id: ${parser.cleanString(ticket.userName, true)}`;

    await redis.set(`admin:pendingAnswer:${ctx.from.id}`, ticketId);

    try {
      await ctx.answerCallbackQuery(text);

      redisFabric.updateMessageSession(userId, {
        state: "support_answer",
      });
    } catch (err) {
      logger.error(err, "answerSupportHandler error");
    }
  },

  answeredSupportHandler: async function (ctx: Context) {
    if (!ctx.from || !ctx.message?.text) return;

    const adminId = ctx.from.id;
    if (adminId !== adminUserId) return;

    const adminPendingKey = `admin:pendingAnswer:${adminId}`;

    const ticketId = await redis.get(adminPendingKey);

    if (!ticketId) return;

    if (!ticketId) {
      await ctx.reply("ℹ️ Нет активного тикета для ответа.");
      return;
    }

    const raw = await redis.get(`support:ticket:${ticketId}`);
    if (!raw) {
      await ctx.reply("❗ Тикет не найден.");
      await redis.del(adminPendingKey);
      return;
    }

    const ticket = JSON.parse(raw);
    const targetUserId = ticket.userId;

    try {
      await ctx.api.sendChatAction(targetUserId, "typing");
    } catch {
      await ctx.reply(
        "❗ Не удалось связаться с пользователем (чат недоступен).",
      );
      await redis.del(adminPendingKey);
      return;
    }

    await new Promise((r) => setTimeout(r, 500));

    let isSent = false;

    try {
      const message = await ctx.api.sendMessage(
        targetUserId,
        `💬 <b>Ответ поддержки</b>\n\n${ctx.message.text}`,
        {
          parse_mode: "HTML",
          protect_content: true,
        },
      );

      logger.warn(
        {
          ticketId,
          toUserId: targetUserId,
          telegramMessageId: message.message_id,
          chatId: message.chat.id,
        },
        "Support request answered by admin.",
      );

      isSent = true;
    } catch (e) {
      logger.error(
        {
          ticketId,
          targetUserId,
          error: e,
        },
        "Failed to send support message",
      );
    }

    if (isSent) {
      ticket.status = "answered";
      ticket.answer = ctx.message.text;
      ticket.updatedAt = new Date().toISOString();

      await redis.set(`support:ticket:${ticketId}`, JSON.stringify(ticket));
      await redis.del(adminPendingKey);

      const usr = parser.cleanString(ticket.userName, true);

      await ctx.reply(
        `✅ Ответ отправлен пользователю ${usr !== "Не указано" ? usr : ""}`,
      );
    } else {
      await ctx.reply("❗ Ошибка отправки ответа...Попробуй еще раз или смотри логи.");
    }
  },

  approveSubscribeHandler: async function (ctx: SessionContext) {
    if (!ctx.callbackQuery) return;
    const context = ctx.callbackQuery.data?.split(":");

    if (!context) return;
    console.log(`_________CONTEXT ${context}`);

    const isReserve = context[4] === "reserve" ? "reserve" : false;
    const isSpecial = context[4] === "special" ? "special" : false;
    const isComplete = context[5];

    function parseCallbackData(data?: string) {
      if (!data) return { ok: false, error: "Нет данных" };

      const parts = data.split(":");
      console.log(parts);
      if (parts.length < 4) return { ok: false, error: "Неправильный формат" };

      const paymentId = parts[2];
      const product = parts[3] as "channel" | "course";
      const parsed = payloadSchema.safeParse({ paymentId, product });

      if (!parsed.success) return { ok: false, error: "Некорректные данные" };

      return { ok: true, paymentId, product };
    }

    async function fetchPayment(
      paymentId: string,
    ): Promise<PaymentPromiseSchema | null> {
      try {
        const rows = await paymentService.getPaymentById(paymentId);

        if (!rows) {
          logger.error({ paymentId }, "Payment not found");
          return null;
        }

        return rows[0];
      } catch (err) {
        logger.error({ err, paymentId }, "Failed to get payment");
        return null;
      }
    }

    async function applySubscription(
      userId: string,
      product: "channel" | "course",
    ) {
      try {
        const req = await subscriptionService.createOrExtendSubscription(
          userId,
          product,
        );

        return req;
      } catch (err) {
        logger.error(
          { err, userId, product },
          "Failed to create/extend subscription",
        );
      }
    }

    async function applyReserve(paymentId: string) {
      try {
        await paymentService.updatePaymentAmount(
          paymentId,
          prices.reserveCourse,
          true,
        );
      } catch (err) {
        logger.error({ err, paymentId }, "Failed to create reserve");
      }
    }

    async function processChannelAccess(
      userId: string,
      paymentId: string,
      subRes: any,
    ) {
      try {
        const currentUser = await userService.get(userId);

        if (currentUser?.inviteChannel) {
          ctx.api.revokeChatInviteLink(
            config.channelId,
            currentUser.inviteChannel,
          );
        }

        const access = await accessService.grantChannelAccess(bot, userId);
        const link = await userService.updateLink({
          userId: userId,
          inviteChannel: access.invite_link,
        });

        const payment = await paymentService.updatePaymentAmount(
          paymentId,
          prices.channel,
        );
        const message = await bot.api.sendMessage(
          userId,
          `Оплата подтверждена. Вам выдан доступ в приватный канал до ${subRes.expires_at
            .toISOString()
            .slice(
              0,
              10,
            )}\n\n❤️Ваша ссылка для доступа:\n${access.invite_link}\nдоступна только вам.`,
          {
            parse_mode: "HTML",
            reply_markup: keyboard.root,
          },
        );
        logger.warn(
          {
            user: userId,
            linkUpdateResult: link,
            paymentResult: payment,
            message: message,
          },
          "Channel access granted",
        );
      } catch (err) {
        logger.error(
          {
            error: err,
            userId: userId,
          },
          "Failed to grant channel access or send message",
        );
      }
    }

    async function processCourseAccess(userId: string, paymentId: string) {
      let finalPaymentPrice: number = 0;

      if (isComplete) {
        finalPaymentPrice = prices.specialCourse - prices.reserveCourse;
      } else {
        finalPaymentPrice = isSpecial ? prices.specialCourse : prices.course;
      }

      try {
        const req = await paymentService.updatePaymentAmount(
          paymentId,
          finalPaymentPrice,
          isReserve ? true : false,
          isComplete ? true : false,
        );

        if (isComplete) await applySubscription(userId, "course");

        const message = await bot.api.sendMessage(
          userId,
          `Оплата подтверждена. Ссылка на курс❤️: ${config.courseLink}`,
          {
            parse_mode: "HTML",
            reply_markup: keyboard.root,
          },
        );

        logger.warn(
          {
            user: userId,
            paymentUpdateResult: req,
            message: message,
          },
          "Paynent update successful.",
        );
      } catch (err) {
        logger.error(
          {
            error: err,
            userId: userId,
          },
          "Failed to send course link or update payment",
        );
      }
    }

    async function processReserveConfirm(userId: string) {
      try {
        const message = await bot.api.sendMessage(
          userId,
          `Оплата подтверждена. Вы зарезервировали курс по специальной цене.\n` +
            `Пожалуйста совершите доплату оставшейся части до 15.12.25, что бы получить доступ.`,
        );
        logger.warn(
          {
            user: userId,
            message: message,
          },
          "Reserve payment confirmed",
        );
      } catch (err) {
        logger.error(
          { err, userId },
          "Failed to confirm reserve course or send message.",
        );
      }
    }

    async function cleanupScreenshot(payment: any) {
      if (!payment.screenshotPath) return;

      try {
        // TODO after 1 mounth delete service
        // deleteFile(payment.screenshotPath);
        // await paymentService.clearPaymentScreenshot(payment.id);
      } catch (err) {
        logger.error(
          { err, paymentId: payment.id },
          "Failed to remove screenshot",
        );
      }
    }

    async function editAdminMessage(
      ctx: Context,
      paymentId: string,
      product: "channel" | "course",
      subRes: any,
    ) {
      if (!ctx.callbackQuery) return;
      try {
        const paymentSession = await redisFabric.getPaymentSession(
          Number(paymentId),
        );
        const user = paymentSession?.userId;

        const prod =
          product === "course" ? production.course : production.channel;
        const expiresAt =
          product === "channel"
            ? `\nПодписка до: ${subRes.expires_at.toISOString().slice(0, 10)}`
            : "";

        const caption =
          `✅ Платёж #${paymentId} подтверждён\n` +
          `Пользователь: ${user[0] === "_" ? user.slice(1) : user}\nПродукт: ${prod}${expiresAt}`;

        if (ctx.callbackQuery.message?.message_id) {
          await ctx.api.editMessageCaption(
            ctx.callbackQuery.message.chat.id as number,
            ctx.callbackQuery.message.message_id,
            {
              caption,
              parse_mode: "HTML",
            },
          );
        }
      } catch (err) {
        logger.warn({ err }, "Failed to edit admin message");
      }
    }

    try {
      const data = ctx.callbackQuery.data;
      const chatId = ctx.chat!.id;
      const parsed = parseCallbackData(data);

      if (!parsed.ok) {
        await ctx.answerCallbackQuery({ text: parsed.error });
        return;
      }

      const { paymentId, product } = parsed;

      if (!paymentId) {
        await ctx.answerCallbackQuery({ text: "Неверный формат данных" });
        return;
      }

      logger.info(
        { admin: ctx.from?.id, paymentId, product },
        "Admin approve clicked",
      );

      const payment = await fetchPayment(paymentId);

      if (!payment) {
        await ctx.answerCallbackQuery({ text: "Платёж не найден" });
        return;
      }

      const userId = payment.userId;
      const subRes = isReserve
        ? await applyReserve(paymentId)
        : await applySubscription(userId, product);

      console.log(`!!! ${subRes}, ${isReserve}`);

      if (product === "channel") {
        await processChannelAccess(userId, paymentId, subRes);
      } else {
        if (isReserve) {
          if (isComplete) {
            await processCourseAccess(userId, paymentId);
          } else {
            await processReserveConfirm(userId);
          }
        } else {
          await processCourseAccess(userId, paymentId);
        }
      }

      redisFabric.delMessageSession(chatId);

      await cleanupScreenshot(payment);
      await ctx.answerCallbackQuery({ text: "Одобрено" });
      await editAdminMessage(ctx, paymentId, product, subRes);

      logger.info(
        { paymentId, userId, product },
        "Approved payment and granted access",
      );
    } catch (err) {
      logger.error({ err }, "adminApproveHandler failed");
      try {
        await ctx.answerCallbackQuery({ text: "Ошибка на сервере" });
      } catch {}
    }
  },
};

export default adminHandler;
