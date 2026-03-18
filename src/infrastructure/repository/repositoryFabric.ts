import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db";
import { payments, subscriptions, users } from "../db/schema";
import { activeRows, PaymentRecord } from "../../shared/types/repository";
import {
  SubscriptionCreateInput,
  SubscriptionUpdateInput,
} from "../schema/subscriptions.schema";
import { PaymentPromiseSchema } from "../schema/payment.schema";
import { logger } from "../../logger";
import { UserCreateSchema, UserUpdateLinkSchema, UserUpdateSchema } from "../schema/users.schema";
import parser from "../../utils/parsers/parsersModule";

const repositoryFabric = {
  user: {
    create: async function({
      userId,
      userName,
      userFullName,
    }: UserCreateSchema): Promise<UserUpdateSchema> {
      const user = await db.insert(users).values({
        userId,
        userName,
        userFullName,
      }).returning();
  
      return parser.mapUsersTable(user[0]);
    },

    update: async function({
      userId,
      userName,
      userFullName,
      inviteChannel,
    }: UserUpdateSchema): Promise<UserUpdateSchema | null> {
      const user = await db
        .update(users)
        .set({
          userName,
          userFullName,
          inviteChannel,
          updatedAt: new Date(),
        })
        .where(eq(users.userId, userId))
        .returning();
  
      if (!user.length) return null;
  
      return parser.mapUsersTable(user[0]);
    },

    updateLink: async function({
      userId,
      inviteChannel,
    }: UserUpdateLinkSchema): Promise<UserUpdateSchema | null> {
      const user = await db
        .update(users)
        .set({
          inviteChannel,
          updatedAt: new Date(),
        })
        .where(eq(users.userId, userId))
        .returning();
    
      if (!user.length) return null;
    
      return parser.mapUsersTable(user[0]);
    },

    get: async function(userId: string): Promise<UserUpdateSchema | null> {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
  
      if (!user.length) return null;
  
      return parser.mapUsersTable(user[0]);
    },
  },
  subscription: {
    create: async function ({
      userId,
      product,
      startAt,
      expireAt,
    }: SubscriptionCreateInput): Promise<SubscriptionUpdateInput[]> {
      const created = await db
        .insert(subscriptions)
        .values({
          userId,
          product,
          startAt,
          expireAt,
          isActive: true,
        })
        .returning();

      return created.map((row) => ({
        id: row.id,
        userId: row.userId,
        product: row.product,
        startAt: row.startAt!,
        expireAt: row.expireAt!,
        isActive: row.isActive!,
      }));
    },

    update: async function (
      date: Date,
      row: activeRows
    ): Promise<SubscriptionUpdateInput[]> {
      const updated: Partial<activeRows> = {
        expireAt: date,
      };

      if (row.isActive === false) {
        updated.isActive = true;
      }

      const rows = await db
        .update(subscriptions)
        .set(updated)
        .where(eq(subscriptions.id, row.id))
        .returning();

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        product: row.product,
        startAt: row.startAt!,
        expireAt: row.expireAt!,
        isActive: row.isActive!,
      }));
    },

    get: async function (
      userId: string,
      product?: string
    ): Promise<SubscriptionUpdateInput[]> {
      const conditions = [
        eq(subscriptions.userId, userId),
        // eq(subscriptions.active, true),
      ];

      if (product !== undefined) {
        conditions.push(eq(subscriptions.product, product));
      }

      const rows = await db
        .select()
        .from(subscriptions)
        .where(and(...conditions));

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        product: row.product,
        startAt: row.startAt!,
        expireAt: row.expireAt!,
        isActive: row.isActive!,
      }));
    },

    getExpired: async function (now: Date) {
      const conditions = [
        lt(subscriptions.expireAt, now),
        eq(subscriptions.isActive, true),
      ];

      return await db
        .select()
        .from(subscriptions)
        .where(and(...conditions));
    },

    getExpiringBetween: async function (start: Date, end: Date) {
      const conditions = [
        gte(subscriptions.expireAt, start),
        lt(subscriptions.expireAt, end),
        eq(subscriptions.isActive, true),
      ];

      return await db
        .select()
        .from(subscriptions)
        .where(and(...conditions));
    },

    updateExpired: async function (
      id: number
    ): Promise<SubscriptionUpdateInput[]> {
      const rows = await db
        .update(subscriptions)
        .set({ isActive: false })
        .where(eq(subscriptions.id, id))
        .returning();

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        product: row.product,
        startAt: row.startAt!,
        expireAt: row.expireAt!,
        isActive: row.isActive!,
      }));
    },

    deleteAll: async function () {
      await db
        .update(subscriptions)
        .set({ isActive: false })
        .where(eq(subscriptions.product, "course"));
    },
  },

  payment: {
    create: async function ({
      userId,
      screenshotPath,
      amount,
      product,
    }: PaymentRecord): Promise<PaymentPromiseSchema[]> {
      const rows = await db
        .insert(payments)
        .values({
          userId: String(userId),
          product,
          amount,
          screenshotPath: screenshotPath ?? null,
        })
        .returning();

      return rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        product: row.product,
        amount: row.amount,
        currency: row.currency ?? "RUB",
        isReserve: row.isReserve!,
        createdAt: row.createdAt!,
        screenshotPath: row.screenshotPath ?? undefined,
      }));
    },

    get: async function (
      userId: string,
      product?: string
    ): Promise<PaymentPromiseSchema[] | null> {
      try {
        const conditions = [eq(payments.userId, userId)];

        if (product) {
          conditions.push(eq(payments.product, product));
        }

        const rows = await db
          .select()
          .from(payments)
          .where(and(...conditions));

        return rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          product: row.product,
          amount: row.amount,
          currency: row.currency ?? "RUB",
          isReserve: row.isReserve!,
          createdAt: row.createdAt!,
          screenshotPath: row.screenshotPath ?? undefined,
        }));
      } catch (err) {
        logger.error(
          JSON.stringify(err, null, 2),
          "Something wrong when getting row by id"
        );
        return null;
      }
    },

    getById: async function (
      id: string
    ): Promise<PaymentPromiseSchema[] | null> {
      try {
        const rows = await db
          .select()
          .from(payments)
          .where(eq(payments.id, Number(id)));

        return rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          product: row.product,
          amount: row.amount,
          currency: row.currency ?? "RUB",
          isReserve: row.isReserve!,
          createdAt: row.createdAt!,
          screenshotPath: row.screenshotPath ?? undefined,
        }));
      } catch (err) {
        logger.error(
          JSON.stringify(err, null, 2),
          "Something wrong when getting row by id"
        );
        return null;
      }
    },

    updateImgPath: async function (id: string) {
      return await db
        .update(payments)
        .set({ screenshotPath: null })
        .where(eq(payments.id, Number(id)));
    },

    updateAmount: async function (
      id: string,
      amount: number,
      reserve?: boolean
    ) {
      return await db
        .update(payments)
        .set({
          amount: amount,
          isReserve: reserve,
        })
        .where(eq(payments.id, Number(id)))
        .returning();
    },

    updateReserve: async function (userId: string, reserve: boolean) {
      const conditions = [eq(payments.userId, userId)];

      if (!reserve) {
        conditions.push(eq(payments.isReserve, true));
      }

      return await db
        .update(payments)
        .set({ isReserve: reserve })
        .where(and(...conditions))
        .returning();
    },

    deleteAll: async function () {
      await db.update(payments).set({ isReserve: false });
    },
  },

  metrics: {
    getSalesSum: async function (scope: string) {
      const conditions = [eq(payments.product, scope)];

      return await db
        .select({ sum: payments.amount })
        .from(payments)
        .where(scope !== "all" ? and(...conditions) : undefined);
    },
  },

  health: {
    check: async function () {
      try {
        return await db.execute(sql`SELECT 1`);
      } catch (err) {
        logger.error({ err }, "DB health check failed");
        return false;
      }
    },
  },
};

export default repositoryFabric;
