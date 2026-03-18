import { Bot } from "grammy";
import { logger } from "../logger";
import { CTXGrammy } from "../shared/types/bot";
import { config } from "../config";

export const cfg = {
  channelId: config.publicId,
  permanentInviteLink: null as string | null,
};

export async function getOrCreatePermanentInvite(
  bot: Bot<CTXGrammy>
): Promise<string> {
  if (cfg.permanentInviteLink) {
    return cfg.permanentInviteLink;
  }

  const chatId = cfg.channelId;

  const invite = await bot.api.createChatInviteLink(chatId, {
    name: "permanent-entry",
  });

  cfg.permanentInviteLink = invite.invite_link;

  logger.info(
    { chatId, invite: invite.invite_link },
    "Permanent invite link created"
  );

  return invite.invite_link;
}
