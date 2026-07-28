import { SaleItemKind, SaleStatus } from "../../generated/prisma/enums";
import { prisma } from "../db/client";
import type { SalesReportRepository } from "../domain/reports/sales/types";

export const salesReportRepository: SalesReportRepository = {
  async list({
    barberShopId,
    from,
    toExclusive,
    itemType,
    serviceId,
    productId,
  }) {
    const itemWhere = {
      kind: itemType
        ? itemType
        : { in: [SaleItemKind.SERVICE, SaleItemKind.PRODUCT] },
      ...(serviceId ? { serviceId } : {}),
      ...(productId ? { productId } : {}),
    };

    return prisma.sale.findMany({
      where: {
        barberShopId,
        deletedAt: null,
        status: SaleStatus.COMPLETED,
        completedAt: { gte: from, lt: toExclusive },
        items: { some: itemWhere },
      },
      select: {
        id: true,
        saleNumber: true,
        completedAt: true,
        client: { select: { firstName: true, lastName: true } },
        staffMember: {
          select: { displayName: true, firstName: true, lastName: true },
        },
        items: {
          where: itemWhere,
          select: {
            id: true,
            kind: true,
            serviceId: true,
            productId: true,
            description: true,
            quantity: true,
            total: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ completedAt: "desc" }, { saleNumber: "desc" }],
    });
  },
};
