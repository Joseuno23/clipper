// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({ sale: { findMany: vi.fn() } }));

vi.mock("../db/client", () => ({ prisma }));

import { salesReportRepository } from "./salesReportRepository";

describe("salesReportRepository", () => {
  beforeEach(() => {
    prisma.sale.findMany.mockReset().mockResolvedValue([]);
  });

  it("queries completed sales by completedAt and item filters", async () => {
    await salesReportRepository.list({
      barberShopId: "shop_1",
      from: new Date("2026-07-27T05:00:00.000Z"),
      toExclusive: new Date("2026-07-28T05:00:00.000Z"),
      itemType: "PRODUCT",
      productId: "product_1",
    });

    expect(prisma.sale.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          barberShopId: "shop_1",
          status: "COMPLETED",
          completedAt: {
            gte: new Date("2026-07-27T05:00:00.000Z"),
            lt: new Date("2026-07-28T05:00:00.000Z"),
          },
          items: { some: { kind: "PRODUCT", productId: "product_1" } },
        }),
        select: expect.objectContaining({
          items: expect.objectContaining({
            where: { kind: "PRODUCT", productId: "product_1" },
          }),
        }),
      }),
    );
  });
});
