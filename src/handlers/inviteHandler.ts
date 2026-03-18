import { Context, InlineKeyboard } from "grammy";
import { messageHandler } from "./messageHandler";
import { logger } from "../logger";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import subscriptionService from "../services/subscriptionService";
import { config } from "../config";
import userService from "../services/usersService";

const inviteHandler = {
  handleInviteMenu: async function(ctx: Context) {
    const session = await redisFabric.getMessageSession(ctx.from!.id);

    if (!session) return;
    if (session.state !== 'admin_invite_req') return;

    const message = ctx.message?.text
    const text = "На какой срок выдать доступ?";
    const keyboard = new InlineKeyboard()
      .text("месяц", "invite:bit")
      .row()
      .text("пожизненно", "invite:forever")
      .row()
      .text("Назад в админ меню", "back:menu:admin");
    await messageHandler.editOrSend(ctx, text, keyboard, `admin_invite_req_${message}`);
  },

  handleInvite: async function(ctx: Context) {
    const text = 'Введите id пользователя, что бы мы попробовали выслать ему ссылку автоматически\nЕсли он не взаимодействовал с этим ботом, то будет выдана ссылка здесь, просто перешлите ее получателю вручную.\n\nУзнать id пользователя можно через @userinfobot => start => User => выберите нужного пользователя => скопируйте и отправьте сюда его Id (цифры)'
    const keyboard = new InlineKeyboard()
      .text("Возврат в админ меню", "back:menu:admin")
      .row()

    const session = await redisFabric.getMessageSession(ctx.from!.id);
    if (!session) {
      logger.error("messageSession on inviteHandler can't found.");
      return;
    }

    const state = session.state as string
    const states = state.split('_')
    const invitedId = states[3];
    const chatId = config.channelId;
    // const userId = ctx.callbackQuery!.from.id;

    if (invitedId) {
      const invite = await ctx.api.createChatInviteLink(chatId, {
        member_limit: 1,
        expire_date: Math.floor(Date.now() / 1000) + 1 * 24 * 60 * 60, // 1d
      })

      const keyboard = new InlineKeyboard()
        .text('В меню', 'menu:start')
        .row();

      try {
        const message = await ctx.api.sendMessage(invitedId, `Привет, вам выдана ссылка в приватный канал ${invite.invite_link}`, {
          reply_markup: keyboard,
        })

        await ctx.reply(`Ссылка выдана пользователю ${invitedId}`, {
          parse_mode: 'HTML',
          reply_markup: keyboard
        })

        logger.warn({
          chatId: ctx.from!.id,
          invitedId: invitedId,
          inviteLink: invite.invite_link,
          state: state,
          message: message,
        }, "Invite send successful by admin.");

        await ctx.answerCallbackQuery();
      } catch(err) {
        const message = await messageHandler.editOrSend(ctx, `пользователь еще не гулял по боту, просто перешли ему инвайт ${invite.invite_link}`, keyboard)
        logger.warn({
          error: err,
          chatId: ctx.from!.id,
          invitedId: invitedId,
          inviteLink: invite.invite_link,
          state: state,
          message: message,
        }, "Invite send successful to admin.");
      }

      const data = ctx.callbackQuery!.data!.split(':');

      await subscriptionService.createOrExtendSubscription(
        invitedId,
        'channel',
        data[1]
      );

      const userExistOrNew = await userService.get(invitedId);

      if (!userExistOrNew) {
        const newUser = await userService.create({
          userId: invitedId,
          userFullName: null,
          userName: null
        });
        await userService.updateLink({
          userId: newUser!.userId,
          inviteChannel: invite.invite_link
        })
      } else {
        if (userExistOrNew.inviteChannel) {
          ctx.api.revokeChatInviteLink(chatId, userExistOrNew.inviteChannel)
        }

        await userService.updateLink({
          userId: invitedId,
          inviteChannel: invite.invite_link
        })
      }

      return;
    } else {
      try {
        await messageHandler.editOrSend(ctx, text, keyboard, "admin_invite_req")
      } catch (err) {
        logger.warn(err);
      }
    }
  }
}

export default inviteHandler;
