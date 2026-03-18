import dotenv from "dotenv";
import env from "./env";

dotenv.config();

export const config = {
  botToken: env.BOT_TOKEN!,
  port: Number(env.PORT),
  pgUrl: env.POSTGRES_URL,
  redisUrl: env.REDIS_URL!,
  adminChatId: env.ADMIN_CHAT_ID!,
  watcher: env.WATCHER_ID,
  channelId: env.CHANNEL_ID!,
  publicId: env.PUBLIC_ID!,
  uploadsDir: env.UPLOADS_DIR!,
  courseLink: env.COURSE_LINK,
};
