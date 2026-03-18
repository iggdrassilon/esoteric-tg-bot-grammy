import { SessionContext } from "../shared/types/context";
import { redis } from "./redis/redisInstance";

export async function resetSession(ctx: SessionContext) {
  const chatId = ctx.chat?.id;
  if (!chatId) return;

  const key = `session:${chatId}`;
  await redis.del(key);

  ctx.session = {
    awaitingScreenshot: false,
    pendingProduct: null,
    currentStep: "root",
    lastMenuMessageId: null,
    temp: {}
  };
}
