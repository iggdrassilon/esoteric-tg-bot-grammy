import { InlineKeyboard } from "grammy";
import { CTXGrammy } from "../shared/types/bot";
import { keys } from "../shared/constants/keyboard";
import { messageHandler } from "./messageHandler";

const default_text = (raw: string) =>
  `Пожалуйста опишите детали вопроса касательно ${raw}.\n` +
  `Мы свяжемся с вами в ближайшее время.`;

const supportHandler = {
  paymentSupport: async function (ctx: CTXGrammy) {
    const text = default_text("оплаты");
    const keyboard = new InlineKeyboard().text(
      keys.backKey,
      "back:support:payment"
    );

    messageHandler.editOrSend(ctx, text, keyboard, "support_payment_ask");
  }.bind(this),

  courseSupport: async function (ctx: CTXGrammy) {
    const text = default_text("курса");
    const keyboard = new InlineKeyboard().text(
      keys.backKey,
      "back:support:payment"
    );

    messageHandler.editOrSend(ctx, text, keyboard, "support_course_ask");
  }.bind(this),

  supscriptionSupport: async function (ctx: CTXGrammy) {
    const text = default_text("канала");
    const keyboard = new InlineKeyboard().text(
      keys.backKey,
      "back:support:channel"
    );

    messageHandler.editOrSend(ctx, text, keyboard, "support_channel_ask");
  }.bind(this),

  justSupport: async function (ctx: CTXGrammy) {
    const text = "Пожалуйста опишите детали вопроса";
    const keyboard = new InlineKeyboard().text(
      keys.backKey,
      "back:support:channel"
    );

    messageHandler.editOrSend(ctx, text, keyboard, "support_just_ask");
  },

  handleSupport: async function (ctx: CTXGrammy, choise: string) {
    switch (choise) {
      case "payment":
        await this.paymentSupport(ctx);
        break;
      case "channel":
        await this.supscriptionSupport(ctx);
        break;
      case "course":
        await this.courseSupport(ctx);
        break;
      case "just":
        await this.justSupport(ctx);
        break;
    }
  },
};

export default supportHandler;
