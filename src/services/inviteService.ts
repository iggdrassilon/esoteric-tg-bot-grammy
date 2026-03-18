import { Bot, Context } from "grammy";
import { logger } from "../logger";
import { config } from "../config";
import { CTXGrammy } from "../shared/types/bot";
import { getOrCreatePermanentInvite } from "../utils/invites";
import { keyboard } from "../shared/constants/keyboard";
import { messageHandler } from "../handlers/messageHandler";

const accessService = {
  grantChannelAccess: async function (bot: Bot<CTXGrammy>, userId: string) {
    const chatId = config.channelId;

    logger.info({ userId, chatId }, "Adding user to group");

    try {
      const res = await bot.api.createChatInviteLink(chatId, {
        // member_limit: 1,
        creates_join_request: true,
        expire_date: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 31d
      });

      logger.info({ userId, chatId }, "User successfully added to the group");
      return res;
    } catch (err) {
      logger.error({ err, userId, chatId }, "Failed to add user to the group");
      throw err;
      
    }
  },

  grantPublicChannelAccess: async function (
    bot: Bot<CTXGrammy>,
    ctx: Context,
    userId: string
  ) {
    const chatId = config.channelId;
  
    logger.info({ userId, chatId }, "Sending permanent channel invite");
  
    try {
      const inviteLink = await getOrCreatePermanentInvite(bot);
  
      await messageHandler.editOrSend(
        ctx,
        `✔️ Ежедневные голосовые сообщения - передача ключей/практик/обход ловушек ума на пути к Пробуждению Сознания.\n\n✔️ Еженедельные эфиры, возможность разобрать вашу ключевую проблему в прямом эфире:\n\n❤️Вход: ${inviteLink}`, 
        keyboard.root,
      );

      logger.info(
        { userId, chatId },
        "Permanent invite successfully sent"
      );
    } catch (err) {
      logger.error(
        { err, userId, chatId },
        "Failed to send permanent invite"
      );
      throw err;
    }
  },

  removeFromChannel: async function (bot: Bot<CTXGrammy>, userId: number) {
    const chatId = config.channelId!;

    logger.info({ userId, chatId }, "Removing user from channel");

    try {
      await bot.api.banChatMember(chatId, userId, {
        until_date: Math.floor(Date.now() / 1000) + 1,
      });
      await bot.api.unbanChatMember(chatId, userId, { only_if_banned: true });

      logger.info({ userId }, "User removed from channel");
    } catch (err) {
      logger.error({ err, userId }, "Failed to remove user");
    }
  },
};

export default accessService;
