import dotenv from 'dotenv';
import { z } from "zod";

const schema = z.object({
  BOT_TOKEN: z.string(),
  PORT: z.string(),
  POSTGRES_URL: z.string(),
  REDIS_URL: z.string(),
  ADMIN_CHAT_ID: z.string(),
  WATCHER_ID: z.string(),
  CHANNEL_ID: z.string(),
  PUBLIC_ID: z.string(),
  UPLOADS_DIR: z.string(),
  COURSE_LINK: z.string(),
  NODE_ENV: z.string()
})

dotenv.config();

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(
    `Env validation error: ${JSON.stringify(parsed.error.issues, null, 2)}`
  );
}

console.log("ENV VALIDATED:", {
  POSTGRES_URL: parsed.data.POSTGRES_URL,
  PORT: parsed.data.PORT,
});

const env = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  PORT: process.env.PORT,
  REDIS_URL: process.env.REDIS_URL,
  POSTGRES_URL: process.env.POSTGRES_URL,
  ADMIN_CHAT_ID: process.env.ADMIN_CHAT_ID,
  WATCHER_ID: process.env.WATCHER_ID,
  CHANNEL_ID: process.env.CHANNEL_ID,
  PUBLIC_ID: process.env.PUBLIC_ID,
  UPLOADS_DIR: process.env.UPLOADS_DIR,
  COURSE_LINK: process.env.COURSE_LINK,
  NODE_ENV: process.env.NODE_ENV
}

export default env;
