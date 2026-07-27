import { prisma } from "../db/client";
import type {
  NormalizedServiceUpdateInput,
  ServiceRepository,
} from "../domain/services/types";

const serviceInclude = {
  allowedRoles: { orderBy: { role: "asc" as const } },
};

export const serviceRepository: ServiceRepository = {
  async list({ barberShopId, pagination }) {
    return prisma.service.findMany({
      where: {
        barberShopId,
        deletedAt: null,
        isActive: true,
        ...buildSearchWhere(pagination.query),
      },
      include: serviceInclude,
      orderBy: [{ name: "asc" }],
      take: pagination.limit,
      skip: pagination.offset,
    });
  },

  async create({ barberShopId, data }) {
    return prisma.service.create({
      data: {
        barberShopId,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        price: data.basePrice,
        allowedRoles: {
          create: data.allowedRoles.map((role) => ({ barberShopId, role })),
        },
      },
      include: serviceInclude,
    });
  },

  async findActiveById({ barberShopId, id }) {
    return prisma.service.findFirst({
      where: { id, barberShopId, deletedAt: null, isActive: true },
      include: serviceInclude,
    });
  },

  async update({ barberShopId, id, data }) {
    const existing = await prisma.service.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.$transaction(async (transaction) => {
      await transaction.service.update({
        where: { id },
        data: toServiceUpdateData(data),
      });

      if (data.allowedRoles !== undefined) {
        await transaction.serviceAllowedRole.deleteMany({
          where: { serviceId: id, barberShopId },
        });

        if (data.allowedRoles.length > 0) {
          await transaction.serviceAllowedRole.createMany({
            data: data.allowedRoles.map((role) => ({
              serviceId: id,
              barberShopId,
              role,
            })),
          });
        }
      }

      return transaction.service.findFirstOrThrow({
        where: { id, barberShopId },
        include: serviceInclude,
      });
    });
  },

  async softDelete({ barberShopId, id, deletedAt }) {
    const existing = await prisma.service.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.service.update({
      where: { id },
      data: { deletedAt, isActive: false },
      include: serviceInclude,
    });
  },
};

function toServiceUpdateData(data: NormalizedServiceUpdateInput) {
  return {
    ...(data.name === undefined ? {} : { name: data.name }),
    ...(data.description === undefined
      ? {}
      : { description: data.description }),
    ...(data.durationMinutes === undefined
      ? {}
      : { durationMinutes: data.durationMinutes }),
    ...(data.basePrice === undefined ? {} : { price: data.basePrice }),
  };
}

function buildSearchWhere(query: string | null) {
  if (!query) return {};

  const words = query.trim().split(/\s+/).filter(Boolean);
  const filters = words.flatMap((word) => [
    { name: { contains: word, mode: "insensitive" as const } },
    { description: { contains: word, mode: "insensitive" as const } },
  ]);

  return filters.length > 0 ? { OR: filters } : {};
}
