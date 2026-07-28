import { prisma } from "../db/client";

export type SettingsRepository = {
  updateShopName(input: { barberShopId: string; name: string }): Promise<void>;
  updateUserDisplayName(input: {
    userId: string;
    displayName: string;
  }): Promise<void>;
  findUserPasswordHash(userId: string): Promise<string | null>;
  updateUserPassword(input: {
    userId: string;
    passwordHash: string;
  }): Promise<void>;
};

export const settingsRepository: SettingsRepository = {
  async updateShopName({ barberShopId, name }) {
    await prisma.barberShop.update({
      where: { id: barberShopId },
      data: { name },
    });
  },

  async updateUserDisplayName({ userId, displayName }) {
    await prisma.user.update({
      where: { id: userId },
      data: { displayName },
    });
  },

  async findUserPasswordHash(userId) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { passwordHash: true },
    });

    return user?.passwordHash ?? null;
  },

  async updateUserPassword({ userId, passwordHash }) {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  },
};
