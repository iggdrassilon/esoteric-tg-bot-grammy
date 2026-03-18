import z from "zod";

const payloadSchema = z.object({
  paymentId: z.string(),
  product: z.enum(["channel", "course"]),
});

export {
  payloadSchema,
}
