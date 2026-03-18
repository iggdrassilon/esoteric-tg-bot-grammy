import { UserUpdateSchema } from "../../infrastructure/schema/users.schema";

const parser = {
  mapUsersTable: (row: any): UserUpdateSchema => {
    return {
      id: row.id,
      userId: row.userId,
      userName: row.userName ?? null,
      userFullName: row.userFullName ?? null,
      createAt: row.createAt!,
      updatedAt: row.updatedAt,
      inviteChannel: row.inviteChannel ?? null,
    };
  },
  cleanString: (s: string | undefined, id?: boolean) =>
    typeof s === "string" && s.replace(/[\s\u00AD\u200B\uFEFF]/g, "").length > 0
      ? id ? `@${s}` : `'${s}'`
      : "Не указано"
}

export default parser
