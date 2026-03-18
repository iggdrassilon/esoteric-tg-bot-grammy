import repositoryFabric from "../infrastructure/repository/repositoryFabric"
import { userCreateSchema, UserCreateSchema, userUpdateLinkSchema, UserUpdateLinkSchema, userUpdateSchema, UserUpdateSchema } from "../infrastructure/schema/users.schema";
import { logger } from "../logger"

const userService = {
  get: async function(id: string) {
    try {
      const existingUser = await repositoryFabric.user.get(id)
      // validate
      return existingUser;
    } catch(err) {
      logger.error(err)
    }
  },

  create: async function(data: UserCreateSchema): Promise<UserCreateSchema | null> {
    try {
      const parsed = userCreateSchema.parse({ ...data, createAt: new Date() })
      const createdUser = await repositoryFabric.user.create(parsed);
      return createdUser;
    } catch(err) {
      logger.error(err)
      return null
    }
  },

  update: async function(data: UserUpdateSchema): Promise<UserUpdateSchema | null> {
    try {
      const parsed = userUpdateSchema.parse(data);
      const updatedUser = await repositoryFabric.user.update(parsed);
      return updatedUser;
    } catch(err) {
      logger.error(err)
      return null;
    }
  },

  updateLink: async function(data: UserUpdateLinkSchema): Promise<UserUpdateSchema | null> {
    try {
      const parsed = userUpdateLinkSchema.parse(data);
      const updatedUser = await repositoryFabric.user.updateLink(parsed);
      return updatedUser;
    } catch(err) {
      logger.error(err)
      return null
    }
  }
}

export default userService;
