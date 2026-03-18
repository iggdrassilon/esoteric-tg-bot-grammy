import { addDays, addMonths } from "date-fns";

const subscribeInterval = 1; // months
const PERMANENT_DATE = new Date("2070-02-22T00:00:00Z");

const dateFabric = {
  startSubscribing: async function (product?: string, period?: string): Promise<{start: Date, expires: Date}> {
    const start = new Date();
    let expires: Date;

    if (period === 'forever') {
      expires = PERMANENT_DATE;
    } else if (product === "course") {
      expires = addMonths(new Date(start), 999);
    } else {
      expires = addMonths(start, subscribeInterval);
      // expires = addMinutes(start, subscribeInterval);
    }

    return {
      start,
      expires,
    };
  },

  updateSubscribing: function (lastDate: Date) {
    // const expires = addMinutes(lastDate, subscribeInterval);
    const expires = addMonths(new Date(lastDate), subscribeInterval);
    return expires;
  },

  getSubscribingLeft: function (expires: Date) {
    const expiresAt = new Date(expires);
    const msPerDay = 1000 * 60 * 60 * 24;
    const daysLeft = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - Date.now()) / msPerDay)
    );
    console.log(`EXP: ${expiresAt}`);
    return { expiresAt, daysLeft };
  },

  getExpiringSubscribeWindow: function () {
    const daysToWarn = 3;
    const now = new Date();
    const windowStart = addDays(now, daysToWarn);
    const windowEnd = addDays(now, daysToWarn + 1);

    return { windowStart, windowEnd };
  },

  getExpiringSubscribeTest: function () {
    const dateNow = new Date();
    const target = new Date(dateNow.getTime() + 1 * 60 * 1000);
    return target;
  },

  getSubscribingLeftTest: function (expires: Date) {
    const expiresAt = new Date(expires);
    const msPerMinute = 1000 * 60;
    const minutesLeft = Math.max(
      0,
      Math.ceil((expiresAt.getTime() - Date.now()) / msPerMinute)
    );

    return minutesLeft;
  },
};

export default dateFabric;
