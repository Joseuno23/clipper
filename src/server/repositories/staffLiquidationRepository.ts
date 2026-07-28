import { SaleItemKind, SaleStatus } from "../../generated/prisma/enums";
import { prisma } from "../db/client";
import type { StaffLiquidationRepository } from "../domain/reports/staffLiquidations/types";

export const staffLiquidationRepository: StaffLiquidationRepository = {
  async list({ barberShopId, from, toExclusive, staffMemberId }) {
    const sales = await prisma.sale.findMany({
      where: {
        barberShopId,
        deletedAt: null,
        status: SaleStatus.COMPLETED,
        completedAt: { gte: from, lt: toExclusive },
        staffMemberId: staffMemberId ?? undefined,
        items: { some: { kind: SaleItemKind.SERVICE } },
      },
      select: {
        id: true,
        saleNumber: true,
        completedAt: true,
        staffMemberId: true,
        staffMember: {
          select: { displayName: true, firstName: true, lastName: true },
        },
        client: { select: { firstName: true, lastName: true } },
        items: {
          where: { kind: SaleItemKind.SERVICE },
          select: {
            id: true,
            serviceId: true,
            description: true,
            quantity: true,
            total: true,
            commissionModeSnapshot: true,
            commissionValueSnapshot: true,
            commissionTotalSnapshot: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: [{ completedAt: "desc" }, { saleNumber: "desc" }],
    });

    return { sales };
  },
};
