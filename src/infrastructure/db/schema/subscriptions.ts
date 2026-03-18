import {
  pgTable,
  serial,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: text('userId').notNull(),
  product: text("product").notNull(),
  startAt: timestamp("startAt").defaultNow(),
  expireAt: timestamp("expireAt").notNull(),
  isActive: boolean("isActive").default(true),
});
