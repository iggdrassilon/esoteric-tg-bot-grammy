import { Context } from "grammy";
import { Next } from "hono";
import { logger } from "../logger";
import userService from "../services/usersService";

async function grammyMiddleware(ctx: Context, next: Next) {
  if (!ctx.from) return next();

  const userId = String(ctx.from.id);
  const userName = ctx.from.username ?? null;
  const userFullName = `${ctx.from.first_name ?? ""} ${ctx.from.last_name ?? ""}`.trim();

  try {
    const existing = await userService.get(userId);

    if (!existing) {
      await userService.create({
        userId,
        userName,
        userFullName,
      });

      logger.info({ userId }, "User firts time here... created in table");
    } else {
      await userService.update({
        id: existing.id,
        userId: userId,
        userName: userName,
        userFullName: userFullName,
        inviteChannel: existing.inviteChannel,
        createAt: existing.createAt,
        updatedAt: new Date(),
      });

      logger.info({ userId }, "User updated (last activity refreshed)");
    }
  } catch (err) {
    logger.error({ err, userId }, "User upsert failed");
  }

  await next();
}

export default grammyMiddleware;
// TODO 
// backups / switch race condition to upsert / made user scheme as no duplicate.