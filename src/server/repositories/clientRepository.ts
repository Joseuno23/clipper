import { prisma } from "../db/client";
import type { ClientRepository } from "../domain/clients/types";

export const clientRepository: ClientRepository = {
  async list({ barberShopId, pagination }) {
    return prisma.client.findMany({
      where: { barberShopId, deletedAt: null },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: pagination.limit,
      skip: pagination.offset,
    });
  },

  async create({ barberShopId, data }) {
    return prisma.client.create({
      data: { barberShopId, ...data },
    });
  },

  async findActiveById({ barberShopId, id }) {
    return prisma.client.findFirst({
      where: { id, barberShopId, deletedAt: null },
    });
  },

  async update({ barberShopId, id, data }) {
    const existing = await prisma.client.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.client.update({
      where: { id },
      data,
    });
  },

  async softDelete({ barberShopId, id, deletedAt }) {
    const existing = await prisma.client.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.client.update({
      where: { id },
      data: { deletedAt },
    });
  },
};
