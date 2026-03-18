import { Context } from "grammy";

interface SessionContext extends Context {
  session?: {
    awaitingScreenshot?: boolean;
    pendingProduct?: any;
    isReserve?: boolean;
    isComplete?: boolean;
    isSpecial?: boolean;
    [key: string]: any;
  };
}

export {
  SessionContext
}
