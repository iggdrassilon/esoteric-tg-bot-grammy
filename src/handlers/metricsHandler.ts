import { InlineKeyboard } from "grammy";
import { SessionContext } from "../shared/types/context";
import metricsService from "../services/metricsService";
import { logger } from "../logger";
import { messageHandler } from "./messageHandler";

const metricsHandler = {
  handleMetrics: async function (ctx: SessionContext) {
    if (!ctx.callbackQuery) {
      try {
        await ctx.answerCallbackQuery({ text: "Неверный запрос" });
        return;
      } catch (err) {
        logger.error({ err }, "Failed to answer callback query");
        return;
      }
    }

    const data = ctx.callbackQuery.data || "";
    const parts = data.split(":");
    const scope = parts[1] as "all" | "course" | "channel";

    let sum = 0;
    try {
      const request = await metricsService.getSalesSum(
        scope === "all" ? "all" : (scope as "course" | "channel")
      );

      if (!request) {
        logger.info("No sales found");
        return await ctx.answerCallbackQuery({ text: "Нет данных scope" });
      }

      sum = request;
    } catch (err) {
      logger.error({ err }, "Failed to fetch metrics");
      await ctx.answerCallbackQuery({ text: "Ошибка" });
      return;
    }

    const names = {
      all: "Все продажи",
      course: "Продажи курса",
      channel: "Продажи паблика",
    };

    const text = `📊 ${names[scope]}\nСумма продаж: ${sum.toLocaleString(
      "ru-RU",
      { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    )} ₽`;

    const keyboard = new InlineKeyboard().text("Назад", "back:menu:admin:metrics");

    await messageHandler.editOrSend(
      ctx,
      text,
      keyboard,
      "admin_metrics_result"
    );
    await ctx.answerCallbackQuery();
  },
};

export default metricsHandler;
