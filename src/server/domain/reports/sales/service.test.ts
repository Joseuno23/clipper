// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createSalesReportService } from "./service";
import type { SalesReportRepository } from "./types";

const context = {
  tenant: {
    barberShopId: "shop_1",
    timezone: "America/Bogota",
    currency: "COP",
  },
} as never;

function decimal(value: string) {
  return { toString: () => value };
}

describe("sales report service", () => {
  it("summarizes services and products by Colombia business day", async () => {
    const repository: SalesReportRepository = {
      list: vi.fn(async () => [
        {
          id: "sale_1",
          saleNumber: "V-1",
          completedAt: new Date("2026-07-27T04:30:00.000Z"),
          client: { firstName: "Ana", lastName: "Ríos" },
          staffMember: {
            displayName: "Sofía",
            firstName: "Sofía",
            lastName: "Paz",
          },
          items: [
            {
              id: "service_item",
              kind: "SERVICE" as const,
              serviceId: "service_1",
              productId: null,
              description: "Corte",
              quantity: 1,
              total: decimal("15000.00"),
            },
            {
              id: "product_item",
              kind: "PRODUCT" as const,
              serviceId: null,
              productId: "product_1",
              description: "Pomada",
              quantity: 2,
              total: decimal("8000.00"),
            },
          ],
        },
      ]),
    };

    const report = await createSalesReportService(repository).getReport(
      context,
      {
        from: "2026-07-26",
        to: "2026-07-26",
        itemType: "all",
        serviceId: "all",
        productId: "all",
      },
    );

    expect(repository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      from: new Date("2026-07-26T05:00:00.000Z"),
      toExclusive: new Date("2026-07-27T05:00:00.000Z"),
      itemType: undefined,
      serviceId: undefined,
      productId: undefined,
    });
    expect(report.summary).toEqual({
      totalRevenue: "23000.00",
      servicesRevenue: "15000.00",
      productsRevenue: "8000.00",
      orderCount: 1,
      itemLineCount: 2,
      quantityTotal: 3,
    });
    expect(report.days[0]?.date).toBe("2026-07-26");
  });
});
