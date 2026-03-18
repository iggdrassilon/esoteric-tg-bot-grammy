import { InlineKeyboard } from "grammy";

const keys = {
  backKey: "Назад",
  menu: "В Меню"
}

const keyboard = {
  root: new InlineKeyboard().text(keys.backKey, "back:root"),
  menu: new InlineKeyboard().text(keys.menu, "back:root"),
}

export {
  keys,
  keyboard
};
