import { prisma } from "../db/client";
import type { ClientRepository } from "../domain/clients/types";
import {
  normalizeDocument,
  normalizePhone,
} from "../domain/shared/normalization";

export const clientRepository: ClientRepository = {
  async list({ barberShopId, pagination }) {
    const searchWhere = buildSearchWhere(pagination.query);
    const baseWhere = { barberShopId, deletedAt: null, ...searchWhere };
    const exactDocument = normalizeDocument(pagination.query ?? "");

    if (exactDocument && pagination.offset === 0) {
      const exactMatches = await prisma.client.findMany({
        where: { ...baseWhere, normalizedDocument: exactDocument },
        orderBy: clientOrderBy,
        take: pagination.limit,
      });

      if (exactMatches.length >= pagination.limit) {
        return exactMatches;
      }

      const remainingMatches = await prisma.client.findMany({
        where: {
          ...baseWhere,
          normalizedDocument: { not: exactDocument },
        },
        orderBy: clientOrderBy,
        take: pagination.limit - exactMatches.length,
        skip: pagination.offset,
      });

      return [...exactMatches, ...remainingMatches];
    }

    return prisma.client.findMany({
      where: baseWhere,
      orderBy: clientOrderBy,
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

const clientOrderBy = [
  { lastName: "asc" as const },
  { firstName: "asc" as const },
];

function buildSearchWhere(query: string | null) {
  if (!query) return {};

  const normalizedDocument = normalizeDocument(query);
  const normalizedPhone = normalizePhone(query);
  const words = query.trim().split(/\s+/).filter(Boolean);

  const filters = [
    ...(normalizedDocument
      ? [{ normalizedDocument: { contains: normalizedDocument } }]
      : []),
    ...(normalizedPhone
      ? [{ normalizedPhone: { contains: normalizedPhone } }]
      : []),
    ...words.flatMap((word) => [
      { firstName: { contains: word, mode: "insensitive" as const } },
      { lastName: { contains: word, mode: "insensitive" as const } },
    ]),
  ];

  return filters.length > 0 ? { OR: filters } : {};
}
