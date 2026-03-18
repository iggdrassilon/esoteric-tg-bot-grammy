import z from "zod";

export const paymentCreateSchema = z.object({
  userId: z.string(),
  product: z.string(),
  amount: z.number(),
  currency: z.string(),
  isReserve: z.boolean(),
  screenshotPath: z.string().optional(),
});

export const paymentPromiseSchena = z.object({
  id: z.number(),
  userId: z.string(),
  product: z.string(),
  amount: z.number(),
  currency: z.string(),
  isReserve: z.boolean(),
  createdAt: z.date(),
  screenshotPath: z.string().optional(),
});

export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentPromiseSchema = z.infer<typeof paymentPromiseSchena>;
