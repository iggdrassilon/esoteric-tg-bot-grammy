import {
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  userId: text('userId').notNull(),
  userName: text("userName"),
  userFullName: text("userFullName"),
  createAt: timestamp("createAt").defaultNow(),
  updatedAt: timestamp('updatedAt'),
  inviteChannel: text('inviteChannel')
});
