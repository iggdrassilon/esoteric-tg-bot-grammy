import { Api, Context, InlineKeyboard, InputFile, RawApi } from "grammy";
import { logger } from "../logger";
import { saveScreenshot } from "../utils/fileStore";
import fetch from "node-fetch";
import { format } from "date-fns";
import paymentService from "../services/paymentService";
import { SessionContext } from "../shared/types/context";
import { config } from "../config";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import { production } from "../shared/constants/production";
import { PaymentPromiseSchema } from "../infrastructure/schema/payment.schema";

const mediaHandler = {
  handlePhoto: async function (ctx: SessionContext) {
    if (!ctx.session) {
      logger.error("handlePhoto: no session in ctx.update");
      return ctx.reply("Ошибка: не удалось определить пользователя.");
    }

    function validateSession(session: any) {
      if (
        !session?.awaitingScreenshot ||
        !session?.pendingProduct
      ) {
        return {
          ok: false,
          message:
            "Пожалуйста сначала подтвердите оплату в меню с реквизитами, затем пришлите скрин.",
        };
      }
      return { ok: true };
    }

    function getUserId(ctx: SessionContext) {
      return ctx.from?.id || ctx.message?.from?.id || null;
    }

    function extractPhoto(ctx: SessionContext) {
      const photos = ctx.message?.photo;
      if (!photos || photos.length === 0) return null;
      return photos[photos.length - 1];
    }

    async function downloadPhoto(api: Api<RawApi>, fileId: string) {
      const info = await api.getFile(fileId);
      if (!info.file_path) throw new Error("file_path missing");

      const url = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${info.file_path}`;
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to download file: ${res.status}`);
      }

      return Buffer.from(await res.arrayBuffer());
    }

    function formatScreenshotFilename(userId: number, product: any) {
      return `${userId}_${product}_${format(
        new Date(),
        "ddMMyyyy_HHmmss"
      )}.jpg`;
    }

    async function notifyAdmin(
      ctx: SessionContext,
      filepath: string,
      payment: PaymentPromiseSchema,
      userId: number,
      product: string,
      username?: string | undefined
    ) {
      const isReserve = ctx.session?.isReserve;
      const isComplete = ctx.session?.isComplete;
      const isSpecial = ctx.session?.isSpecial;
      const displayUser = username ? `@${username}` : `<a href="tg://user?id=${userId}">${userId}</a>`;

      const keyboard = new InlineKeyboard().text(
        `Одобрить ${
          isReserve
            ? "резерв"
            : isComplete
            ? "доплату резерва"
            : isSpecial
            ? "оплату спец цены"
            : product === "course"
            ? "оплату курса"
            : "оплату канала"
        }`,
        `admin:approve:${payment.id}:${payment.product}${
          isReserve
            ? ":reserve"
            : isComplete
            ? ":reserve:complete"
            : isSpecial
            ? ":special"
            : ""
        }`
      );

      const prod =
        payment.product === "course" ? production.course : production.channel;
      const caption =
        `Пользователь ${displayUser} подтвердил ${
          isReserve
            ? "бронирование"
            : isComplete
            ? "доплату резерва"
            : isSpecial
            ? "оплату спец цены"
            : product === "course"
            ? "оплату курса"
            : "оплату канала"
        }.\nПродукт: ${prod}.\n` + `paymentId=${payment.id}`;

      await redisFabric.setPaymentSession(payment.id, {
        userId: username ? `_${userId}` : userId,
        product: payment.product,
        paymentId: payment.id,
      });

      await ctx.api.sendPhoto(
        Number(config.adminChatId),
        new InputFile(filepath),
        {
          caption,
          parse_mode: "HTML",
          // protect_content: true,
          reply_markup: keyboard,
        }
      );
    }

    try {
      const validation = validateSession(ctx.session);

      if (validation.message && !validation.ok)
        return ctx.reply(validation.message);

      const pendingProduct = ctx.session.pendingProduct;
      const userId = getUserId(ctx);

      if (!userId) {
        logger.error("handlePhoto: no userId in ctx.update");
        return ctx.reply("Ошибка: не удалось определить пользователя.");
      }

      const photo = extractPhoto(ctx);

      if (!photo)
        return ctx.reply(
          "❌ Это не похоже на изображение.\n" +
          "Пожалуйста, отправьте **скриншот в формате JPG или PNG**."
        );

      const buffer = await downloadPhoto(ctx.api, photo.file_id);
      const filename = formatScreenshotFilename(userId, pendingProduct);
      const filepath = await saveScreenshot(buffer, filename);
      buffer.fill(0);
      const payment = await paymentService.createPaymentRecord({
        userId,
        product: pendingProduct,
        amount: 0,
        screenshotPath: filepath,
      });

      if (!payment) {
        logger.error("handlePhoto: failed to create payment record");
        return ctx.reply("Ошибка: не удалось создать запись о платеже.");
      }

      // if (!ctx.from || !ctx.from.username) {
      //   logger.error("handlePhoto: no username in ctx.update");
      //   return ctx.reply("Ошибка: не удалось определить пользователя.");
      // }

      await notifyAdmin(
        ctx,
        filepath,
        payment,
        userId,
        pendingProduct,
        ctx.from?.username,
      );

      await ctx.reply("Скрин получен. Пожалуйста дождитесь подтверждения.");

      ctx.session.awaitingScreenshot = false;
      ctx.session.pendingProduct = null;

      logger.info(
        { user: userId, filepath, paymentId: payment.id },
        "Screenshot saved and admin notified"
      );
    } catch (err) {
      logger.error({ err }, "handlePhoto failed (global catch)");
      await ctx.reply(
        "Произошла ошибка при обработке фото. Попробуйте ещё раз."
      );
    }
  },
  
  handleDocument: async function(ctx: Context) {
    const doc = ctx.message?.document;

    if (!doc) return;

    const mime = doc.mime_type ?? "";
    const filename = doc.file_name ?? "";

    const isImage =
      mime.startsWith("image/") ||
      /\.(jpg|jpeg|png)$/i.test(filename);

    if (!isImage) {
      await ctx.reply(
        "❌ Пожалуйста, пришлите **скриншот в виде изображения** (JPG или PNG).\n\n" +
        "PDF и другие файлы не принимаются."
      );
      return;
    }

    await ctx.reply(
      "⚠️ Пожалуйста, отправьте изображение <b>как фото или скриншот</b>, а не как файл.\nОбязательно применить сжатие.\n",
      { parse_mode: "HTML" }
    );
  }
};

export default mediaHandler;
