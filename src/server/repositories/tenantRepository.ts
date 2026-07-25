import { prisma } from "../db/client";
import type { TenantRepository } from "../domain/tenant/types";

export const tenantRepository: TenantRepository = {
  async findActiveBySlug(slug) {
    return prisma.barberShop.findFirst({
      where: {
        slug,
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        slug: true,
        timezone: true,
        currency: true,
      },
    });
  },
};
