import { Context, SessionFlavor } from "grammy";

export interface BotSession {
  awaitingScreenshot?: boolean; 
  pendingProduct?: string | null;
  isReserve?: boolean;

  currentStep?: string | null;
  lastMenuMessageId?: number | null;

  temp?: Record<string, any>;
}


export type CTXGrammy = Context & SessionFlavor<BotSession>;
