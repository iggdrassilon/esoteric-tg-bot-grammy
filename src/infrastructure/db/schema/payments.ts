import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean
} from "drizzle-orm/pg-core";

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: text('userId').notNull(),
  product: text("product").notNull(),
  amount: integer("amount").notNull().default(0),
  currency: text("currency").default("RUB"),
  isReserve: boolean("isReserve").default(false),
  createdAt: timestamp("createdAt").defaultNow(),
  screenshotPath: text("screenshotPath"),
});
