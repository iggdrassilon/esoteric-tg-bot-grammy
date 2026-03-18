import { redisFabric } from "../infrastructure/repository/redisFabric";
import menuHandler from "../handlers/menuHandler";
import { SessionContext } from "../shared/types/context";

function messageGuard(
  handler: (ctx: SessionContext) => Promise<void>
) {
  return async (ctx: SessionContext) => {
    const chatId = ctx.chat!.id;
    const msgId = ctx.callbackQuery?.message?.message_id;

    const session = await redisFabric.getMessageSession(chatId);

    if (!session || session.message_id !== msgId) {
      await ctx.answerCallbackQuery({
        text: "Бот обновлен, это меню больше не актуально, показываю новое меню👌",
        show_alert: true
      });

      await menuHandler.handleRoot(ctx, true);
      return;
    }

    await handler(ctx);
  };
}

export default messageGuard;
