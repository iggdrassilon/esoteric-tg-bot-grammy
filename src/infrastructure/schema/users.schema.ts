import z from "zod";

export const userCreateSchema = z.object({
  userId: z.string(),
  userName: z.string().nullable(),
  userFullName: z.string().nullable(),
})

export const userUpdateSchema = z.object({
  id: z.number(),
  userId: z.string(),
  userName: z.string().nullable(),
  userFullName: z.string().nullable(),
  createAt: z.date(),
  updatedAt: z.date(),
  inviteChannel: z.string().nullable(),
})

export const userUpdateLinkSchema = z.object({
  userId: z.string(),
  inviteChannel: z.string().nullable(),
});

export type UserCreateSchema = z.infer<typeof userCreateSchema>
export type UserUpdateSchema = z.infer<typeof userUpdateSchema>

export type UserUpdateLinkSchema = z.infer<typeof userUpdateLinkSchema>
