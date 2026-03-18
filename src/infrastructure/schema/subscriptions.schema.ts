import z from "zod";

export const subscriptionCreateSchema = z.object({
  userId: z.string(),
  product: z.string().min(1),
  startAt: z.date(),
  expireAt: z.date(),
});

export const subscriptionUpdateSchema = z.object({
  id: z.number(),
  userId: z.string(),
  product: z.string().min(1),
  startAt: z.date(),
  expireAt: z.date(),
  isActive: z.boolean().default(true),
});

export type SubscriptionCreateInput = z.infer<typeof subscriptionCreateSchema>;
export type SubscriptionUpdateInput = z.infer<typeof subscriptionUpdateSchema>;
