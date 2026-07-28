import { describe, expect, it } from "vitest";

import type {
  SalesReportDto,
  StaffLiquidationReportDto,
} from "@/shared/api/reports";

import { salesReportCsvRows, staffLiquidationCsvRows } from "./reportDownload";

describe("reportDownload", () => {
  it("builds sales report CSV rows from the filtered report data", () => {
    const report: SalesReportDto = {
      from: "2026-07-27",
      to: "2026-07-27",
      itemType: "all",
      serviceId: "all",
      productId: "all",
      summary: {
        totalRevenue: "15000.00",
        servicesRevenue: "15000.00",
        productsRevenue: "0.00",
        orderCount: 1,
        itemLineCount: 1,
        quantityTotal: 1,
      },
      days: [
        {
          date: "2026-07-27",
          totalRevenue: "15000.00",
          servicesRevenue: "15000.00",
          productsRevenue: "0.00",
          orderCount: 1,
          itemLineCount: 1,
          quantityTotal: 1,
          items: [
            {
              saleId: "sale_1",
              saleNumber: "V-1",
              clientName: "Ana Ríos",
              staffName: "Sofía Paz",
              itemType: "SERVICE",
              itemName: "Corte clásico",
              quantity: 1,
              total: "15000.00",
            },
          ],
        },
      ],
    };

    expect(salesReportCsvRows(report)).toContainEqual([
      "2026-07-27",
      "V-1",
      "Servicio",
      "Ana Ríos",
      "Corte clásico",
      "1",
      "Sofía Paz",
      "15000.00",
    ]);
  });

  it("builds staff liquidation CSV rows from visible filtered details", () => {
    const report: StaffLiquidationReportDto = {
      from: "2026-07-27",
      to: "2026-07-27",
      staffMemberId: "all",
      summaries: [
        {
          staffMemberId: "staff_1",
          staffName: "Sofía Paz",
          soldTotal: "10000.00",
          commissionTotal: "2500.00",
          orderCount: 1,
          serviceLineCount: 1,
        },
      ],
      details: [
        {
          staffMemberId: "staff_1",
          staffName: "Sofía Paz",
          soldTotal: "10000.00",
          commissionTotal: "2500.00",
          orderCount: 1,
          serviceLineCount: 1,
          days: [
            {
              date: "2026-07-27",
              soldTotal: "10000.00",
              commissionTotal: "2500.00",
              orderCount: 1,
              serviceLineCount: 1,
              items: [
                {
                  saleId: "sale_1",
                  saleNumber: "V-1",
                  clientName: "Ana Ríos",
                  serviceName: "Corte clásico",
                  quantity: 1,
                  soldTotal: "10000.00",
                  commissionTotal: "2500.00",
                },
              ],
            },
          ],
        },
      ],
    };

    expect(staffLiquidationCsvRows(report)).toContainEqual([
      "2026-07-27",
      "Sofía Paz",
      "V-1",
      "Ana Ríos",
      "Corte clásico",
      "1",
      "10000.00",
      "2500.00",
    ]);
  });
});
