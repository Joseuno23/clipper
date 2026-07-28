// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  sale: { findMany: vi.fn() },
}));

vi.mock("../db/client", () => ({ prisma }));

import { staffLiquidationRepository } from "./staffLiquidationRepository";

describe("staffLiquidationRepository", () => {
  beforeEach(() => {
    prisma.sale.findMany.mockReset().mockResolvedValue([
      {
        id: "sale_1",
        staffMemberId: "staff_1",
        items: [{ serviceId: "service_1" }, { serviceId: null }],
      },
    ]);
  });

  it("queries completed sales by completedAt and service items only", async () => {
    await staffLiquidationRepository.list({
      barberShopId: "shop_1",
      from: new Date("2026-07-27T00:00:00.000Z"),
      toExclusive: new Date("2026-07-28T00:00:00.000Z"),
      staffMemberId: "staff_1",
    });

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barberShopId: "shop_1",
          status: "COMPLETED",
          completedAt: {
            gte: new Date("2026-07-27T00:00:00.000Z"),
            lt: new Date("2026-07-28T00:00:00.000Z"),
          },
          staffMemberId: "staff_1",
          items: { some: { kind: "SERVICE" } },
        }),
        select: expect.objectContaining({
          items: expect.objectContaining({ where: { kind: "SERVICE" } }),
        }),
      }),
    );
    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          items: expect.objectContaining({
            select: expect.objectContaining({
              commissionModeSnapshot: true,
              commissionValueSnapshot: true,
              commissionTotalSnapshot: true,
            }),
          }),
        }),
      }),
    );
  });
});
