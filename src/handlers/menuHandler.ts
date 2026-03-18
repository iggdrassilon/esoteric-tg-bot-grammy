import { Context, InlineKeyboard } from "grammy";
import { logger } from "../logger";
import { redisFabric } from "../infrastructure/repository/redisFabric";
import subscriptionService from "../services/subscriptionService";
import prices from "../shared/constants/tariffs";
import { SessionContext } from "../shared/types/context";
import { resetSession } from "../utils/session";
import { production } from "../shared/constants/production";
import env from "../env";
import { config } from "../config";
import { keys } from "../shared/constants/keyboard";
import { messageHandler } from "./messageHandler";
import paymentService from "../services/paymentService";
// import { PaymentPromiseSchema } from "../infrastructure/schema/payment.schema";
import { paidRules } from "../shared/types/paid";
import accessService from "../services/inviteService";
import { bot } from "../bot";
import userService from "../services/usersService";

const menuHandler = {
  handleRoot: async function (ctx: SessionContext, force?: boolean) {
    if (!ctx.from || !ctx.from.id) {
      logger.error("handleRoot: no userId in ctx.update");
      return ctx.reply("Ошибка: не удалось определить пользователя.");
    }

    resetSession(ctx);

    const userId = ctx.from.id;
    const admin = config.adminChatId;
    const text = `Приветствую тебя в Источнике💙 Выбери путь:\n ­`;

    const keyboard = new InlineKeyboard()
      .text("Доступ в безоплатный канал", "tariff:public")
      .row()
      .text("Курс ИСТОЧНИК", "tariff:course")
      .row()
      .text("Доступ в закрытый канал", "tariff:channel")
      .row()
      .text("Моя подписка", "menu:subscription")
      .row()
      .text("Связаться с поддержкой❤️", "menu:support");

    if (Number(admin) === userId) {
      keyboard.row().text("Admin", "menu:admin");
    }

    await messageHandler.editOrSend(ctx, text, keyboard, "root", force);
    logger.info({ user: ctx.from?.id }, "Root shown");
  },

  handleTariffs: async function (ctx: Context) {
    const text = `Выберите тариф:`;
    const keyboard = new InlineKeyboard()
      .text("Курс", "tariff:course")
      .row()
      .text("Подписка на канал", "tariff:channel")
      .row()
      .text(keys.backKey, "back:root");

    await messageHandler.editOrSend(ctx, text, keyboard, "tariffs");
  },

  handleTariffChoice: async function (
    ctx: SessionContext,
    choice: "course" | "channel" | "public",
    reserve?: boolean
  ) {
    let isReserve: boolean = false;
    // let isReserved: PaymentPromiseSchema | null = null;

    const keyboard = new InlineKeyboard();

    async function modulation() {
      const userId = String(ctx.from?.id);
      let text: string = "";
      let button: string = "";

      switch (choice) {
        case "course":
          const activeSubscriptionCourse =
            await subscriptionService.getActiveSubscriptionInfo(
              userId,
              "course"
            );

          const findActive = activeSubscriptionCourse.find(
            (subscr) => subscr.isActive
          );

          if (findActive) {
            await ctx.answerCallbackQuery({
              text: "Вы уже приобрели курс, приятной практики 🩵",
              show_alert: true,
            });
            break;
          }

          const reservedPayment = await paymentService.getReservedPayment(
            userId,
            choice
          );
          // isReserved = reservedPayment;

          // if (!isReserved) {
          //   keyboard
          //     .text(
          //       `${prices.specialCourse}₽ Цена до 20.01`,
          //       `requisites:${choice}:special`
          //     )
          //     .row();
          // }

          text = `Курс «Источник» — это ваша дорожная карта на пути к Пробуждению Сознания.\n\n▫️В течение 10 лет я находилась в поиске истины: прошла через множество учений, «гуру», религий, психологию, эзотерику, трансперсональные опыты. Отсеивая зёрна от плевел, коих 90% в открытом пространстве, я нашла то, что действительно способно Пробудить Сознание. И сегодня для меня честь передать тебе знание, которое освобождает от забвения ума и раскрывает Творца внутри тебя.\n\n✔️ Курс включает в себя восьмиступенчатую программу по перестройке мозга на физиологическом уровне — на режим Пробуждения Сознания. Это программа буддийских практик осознанности, разработанная всемирно известным учёным и профессором медицины, адаптированная под современного человека, соединённая с научным подходом и лишённая религиозного контекста.\n\n✔️ Также в курс я включила множество последовательных эффективных методик по выходу за пределы ума и рекомендации, что позволят не свернуть и пройти путь мягче.\n\n▫️Изучение курса проходит в самостоятельном режиме в течение двух месяцев.\n\n▫️В закрытом телеграм канале по подписке вы можете совместно практиковать, задавать вопросы, получать поддержку и ценные рекомендации по пути прохождения курса.`;

          if (!reservedPayment) {
            // text += `${prices.specialCourse}₽ спец. цена курса до 15.12.25`;
            button = `${prices.course}₽ оплатить`;
          } else {
            isReserve = true;
            text += `${prices.specialCourse}₽ спец. цена курса успешно зарезервирована до 15.12.25`;
            button = `${
              prices.specialCourse - prices.reserveCourse
            }₽ Осталось доплатить.`;
          }
          break;

        case "channel":
          text = `❤️В приватном канале:\n\n✔️Ежедневные голосовые сообщения - передача ключей/практик/обход ловушек ума на пути Пробуждения Сознания.\n\n✔️ Ежедневные совместные практики концентрации для Пробуждения Наблюдателя, дают возможность находиться в дисциплине и не свернуть с пути.\n\n✔️ Возможность задавать вопросы и общаться в чате. Это позволяет не застрять в иллюзиях ума.\n\n✔️ Присутствие в моем поле и поле людей, чей вектор внимания направлен в сторону Пробуждения Сознания. Это усиливает и ускоряет ваш путь многократно.`;
          button = `Оплатить ${prices.channel}₽/месяц`;
          break;

        case "public":
          await accessService.grantPublicChannelAccess(bot, ctx, userId);

        default:
          break;
      }

      return { text, button };
    }

    const { button, text } = await modulation();

    keyboard
      .text(
        button,
        `requisites:${choice}${isReserve ? ":reserve:complete" : ""}`
      )
      .row();

    if (reserve && !isReserve && choice !== "channel") {
    //   keyboard
    //     .text(
    //       `${prices.reserveCourse}₽ забронировать спец. цену до 20.12.25`,
    //       `requisites:${choice}:reserve`
    //     )
    //     .row();
    }

    keyboard
      .text("Связаться с поддержкой❤️", "menu:support:course")
      .row()
      .text(keys.backKey, "back:root");

    if (!text) return;
    await messageHandler.editOrSend(
      ctx,
      text,
      keyboard,
      `product:${choice}${isReserve ? ":reserve" : ""}`
    );
  },

  handleRequisites: async function (
    ctx: SessionContext,
    choice: "course" | "channel",
    status?: "reserve" | "special" | undefined,
    complete?: boolean
  ) {
    const isSpecial = status === "special" ? true : false;
    const reserve = status === "reserve" && !complete ? true : false;

    logger.info(
      JSON.stringify(
        `requisites:\nproduction:${choice}\nstatus: ${status}\ncomplete:${complete}`,
        null,
        2
      )
    );

    let text = `ПОЖАЛУЙСТА! После перевода не забудьте нажать «Я оплатил» и прикрепите СКРИНШОТ оплаты❤️\n\n`;
    switch (choice) {
      case "channel":
        text +=
          `Реквизиты на оплату для доступа в приватный канал::\n\n` +
          `Получатель: ${production.countess}\n` +
          `Номер карты: ${production.count}\n` +
          `Сумма: ${prices.channel}₽\n\n` +
          `Для оплаты из-за рубежа пожалуйста напишите в поддержку.`;
        break;
      case "course":
        text +=
          `Реквизиты для ${complete ? "доплаты" : "оплаты"} ${
            reserve ? "бронирования" : ""
          } курса:\n\n` +
          `Получатель: ${production.countess}\n` +
          `Номер карты: ${production.count}\n` +
          `Сумма: ${
            reserve
              ? prices.reserveCourse
              : complete
              ? prices.specialCourse - prices.reserveCourse
              : isSpecial
              ? prices.specialCourse
              : prices.course
          }₽\n\n` +
          `После перевода нажмите «${`${
            reserve ? "Я забронировал" : complete ? "Я доплатил" : "Я оплатил"
          }`}» и прикрепите скрин.`;
        break;
    }

    const keyboard = new InlineKeyboard()
      .text(
        `${reserve ? "Я забронировал" : complete ? "Я доплатил" : "Я оплатил"}`,
        `paid:${choice}${
          reserve
            ? ":reserve"
            : complete
            ? ":reserve:complete"
            : isSpecial
            ? ":special"
            : ""
        }`
      )
      .row()
      .text(keys.backKey, `back:product:${choice}`);

    await messageHandler.editOrSend(
      ctx,
      text,
      keyboard,
      `requisites:${choice}${
        reserve
          ? ":reserve"
          : complete
          ? ":reserve:complete"
          : isSpecial
          ? ":special"
          : ""
      }`
    );
  },

  handlePaidPressed: async function (ctx: SessionContext, params: paidRules) {
    const { choice, isCompleteReserve, isReserve, isSpecial } = params;
    logger.warn({ choice, isCompleteReserve, isReserve, isSpecial }, 'handle pressed params')
    const chatId = ctx.chat!.id as number;
    const session = await redisFabric.getMessageSession(chatId);
    const pendingText =
      `${
        isReserve
          ? "Резерв"
          : isCompleteReserve
          ? "Подтвердение резерва"
          : "Оплата"
      } ${choice === "channel" ? "доступа в канал" : "курса Осознанности"}${
        isSpecial ? " по спец.цене" : ""
      } зарегистрирован${
        !isReserve ? (isCompleteReserve ? "о" : "а") : ""
      }.\n` + `Пожалуйста, пришлите скриншот перевода в этот чат.\n`;

    const keyboard = new InlineKeyboard().text(
      keys.backKey,
      `back:requisites:${choice}${
        isReserve
          ? ":reserve"
          : isCompleteReserve
          ? ":reserve:complete"
          : isSpecial
          ? ":special"
          : ""
      }`
    );

    if (session && session.message_id) {
      try {
        await ctx.api.editMessageText(
          chatId,
          Number(session.message_id),
          pendingText,
          {
            reply_markup: keyboard,
          }
        );

        session.state = `awaiting_screenshot:${choice}${
          isReserve
            ? ":reserve"
            : isCompleteReserve
            ? ":reserve:complete"
            : isSpecial
            ? ":special"
            : ""
        }`;

        await redisFabric.setMessageSession(chatId, session);

        ctx.session = ctx.session || {};
        ctx.session.pendingProduct = choice;
        ctx.session.awaitingScreenshot = true;
        ctx.session.isReserve = isReserve
          ? isCompleteReserve
            ? false
            : true
          : false;
        ctx.session.isComplete = isCompleteReserve ? true : false;
        ctx.session.isSpecial = isSpecial ? true : false;

        logger.info(
          { user: ctx.from?.id, product: choice },
          "Edited message -> awaiting screenshot (session updated)"
        );

        await ctx.answerCallbackQuery();
        return;
      } catch (err) {
        logger.error(
          { err, user: ctx.from?.id },
          "Failed to edit session message for awaiting screenshot"
        );
      }
    }

    const msg = await ctx.reply(pendingText, { reply_markup: keyboard });
    await redisFabric.setMessageSession(chatId, {
      message_id: msg.message_id,
      state: `awaiting_screenshot:${choice}${
        isReserve
          ? ":reserve"
          : isCompleteReserve
          ? ":reserve:complete"
          : isSpecial
          ? ":special"
          : ""
      }`,
    });

    ctx.session = ctx.session || {};
    ctx.session.pendingProduct = choice;
    ctx.session.awaitingScreenshot = true;
    ctx.session.isReserve = isReserve
      ? isCompleteReserve
        ? false
        : true
      : false;
    ctx.session.isComplete = isCompleteReserve ? true : false;
    ctx.session.isSpecial = isSpecial ? true : false;

    logger.warn(
      { user: ctx.from?.id, product: choice },
      "Fallback: sent new message for awaiting screenshot"
    );

    await ctx.answerCallbackQuery();
  },

  handleMySubscription: async function (ctx: Context) {
    const userId = String(ctx.from!.id);
    const subscriptions = await subscriptionService.getActiveSubscriptionInfo(
      userId
    );
    const userInfo = await userService.get(userId);

    const emptyMsg = "У вас нет активных подписок.";
    console.log(subscriptions);

    let text: string;

    if (subscriptions.length > 0) {
      const activeSubs = subscriptions.filter(s => s.isActive);

      if (activeSubs.length === 0) {
        text = emptyMsg;
      } else {
        text = activeSubs
          .map((info) => {
            const prod =
              info.product === "course" ? production.course : production.channel;
            const daysLeft = info.daysLeft;
            const expiredAt = info.expiresAt.toISOString().slice(0, 10);
    
            return info.product === "course"
              ? `У вас приобретен: ${prod}\n${env.COURSE_LINK}`
              : `У вас активная подписка: ${prod}\n` +
                `Осталось дней: ${daysLeft}\nДо: ${expiredAt}\n` +
                `Ссылка ${userInfo?.inviteChannel}`;
          })
          .join("\n\n");
      }
    }
     else {
      text = emptyMsg;
    }

    const keyboard = new InlineKeyboard().text(keys.backKey, "back:root");
    await messageHandler.editOrSend(ctx, text, keyboard, "subscription");
  },

  handleMySupport: async function (ctx: Context, route: string) {
    const text = "Выберете из пунктов:";

    const keyboard = new InlineKeyboard()
      // .text("Проблема с оплатой", "support:payment")
      // .row()
      // .text("Проблема с курсом", "support:course")
      // .row()
      // .text("Проблема с подпиской на канал", "support:channel")
      // .row()
      .text("Задать вопрос/сообщить о проблеме", "support:just")
      .row()
      .text(keys.backKey, `back:${route}`);

    await messageHandler.editOrSend(ctx, text, keyboard, "suppport");
  },

  handleAdminMenu: async function(ctx: Context) {
    const text = "Выберете из пунктов:";

    const keyboard = new InlineKeyboard()
      .text("Метрики", "menu:admin:metrics")
      .row()
      .text("Инвайт", "menu:admin:invite")
      .row()
      .text("На главную", "back:root")

    await messageHandler.editOrSend(ctx, text, keyboard, "admin_menu");
  },

  handleMetricsMenu: async function (ctx: Context) {
    const keyboard = new InlineKeyboard()
      .text("Все продажи", "metrics:all")
      .row()
      .text("Продажи курса", "metrics:course")
      .row()
      .text("Продажи паблика", "metrics:channel")
      .row()
      .text(keys.backKey, "back:menu:admin");

    await messageHandler.editOrSend(
      ctx,
      "Выберите метрику:",
      keyboard,
      "admin_metrics"
    );
  },
};

export default menuHandler;
