// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { createStaffLiquidationService } from "./service";
import type {
  StaffLiquidationRepository,
  StaffLiquidationRepositoryResult,
} from "./types";

const context = {
  user: {
    id: "user_1",
    email: "admin@test.dev",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    slug: "clipper",
    timezone: "America/Bogota",
    currency: "COP",
  },
  membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
  tokenClaims: {
    sub: "user_1",
    barberShopId: "shop_1",
    barberShopSlug: "clipper",
    role: "OWNER",
    membershipStatus: "ACTIVE",
    typ: "access",
  },
} as const;

function decimal(value: string) {
  return { toString: () => value };
}

function repository(
  result: StaffLiquidationRepositoryResult,
): StaffLiquidationRepository {
  return { list: vi.fn(async () => result) };
}

describe("staff liquidation service", () => {
  it("summarizes completed service sales by staff and excludes product-only sales", async () => {
    const repo = repository({
      sales: [
        {
          id: "sale_1",
          saleNumber: "V-1",
          completedAt: new Date("2026-07-27T12:00:00.000Z"),
          staffMemberId: "staff_1",
          staffMember: {
            displayName: "Sofía",
            firstName: "Sofía",
            lastName: "Paz",
          },
          client: { firstName: "Ana", lastName: "Ríos" },
          items: [
            {
              id: "item_1",
              serviceId: "service_1",
              description: "Corte",
              quantity: 1,
              total: decimal("10000.00"),
              commissionModeSnapshot: "PERCENTAGE_BPS",
              commissionValueSnapshot: decimal("2500"),
              commissionTotalSnapshot: decimal("2500.00"),
            },
            {
              id: "product_item_1",
              serviceId: null,
              description: "Pomada",
              quantity: 2,
              total: decimal("8000.00"),
              commissionModeSnapshot: null,
              commissionValueSnapshot: null,
              commissionTotalSnapshot: null,
            },
          ],
        },
      ],
    });

    const report = await createStaffLiquidationService(repo).getReport(
      context,
      {
        from: "2026-07-27",
        to: "2026-07-27",
        staffMemberId: "all",
      },
    );

    expect(repo.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      from: new Date("2026-07-27T05:00:00.000Z"),
      toExclusive: new Date("2026-07-28T05:00:00.000Z"),
      staffMemberId: undefined,
    });
    expect(report.summaries).toEqual([
      expect.objectContaining({
        staffMemberId: "staff_1",
        soldTotal: "10000.00",
        commissionTotal: "2500.00",
        orderCount: 1,
        serviceLineCount: 1,
      }),
    ]);
    expect(report.details[0]?.days[0]).toEqual(
      expect.objectContaining({
        date: "2026-07-27",
        soldTotal: "10000.00",
        commissionTotal: "2500.00",
        orderCount: 1,
        serviceLineCount: 1,
      }),
    );
  });

  it("supports fixed, none, and missing commission configs", async () => {
    const repo = repository({
      sales: [
        {
          id: "sale_1",
          saleNumber: "V-1",
          completedAt: new Date("2026-07-27T12:00:00.000Z"),
          staffMemberId: "staff_1",
          staffMember: {
            displayName: "Sofía",
            firstName: "Sofía",
            lastName: "Paz",
          },
          client: null,
          items: [
            {
              id: "fixed",
              serviceId: "service_1",
              description: "Color",
              quantity: 2,
              total: decimal("30000.00"),
              commissionModeSnapshot: "FIXED_AMOUNT",
              commissionValueSnapshot: decimal("1500.00"),
              commissionTotalSnapshot: decimal("3000.00"),
            },
            {
              id: "none",
              serviceId: "service_2",
              description: "Lavado",
              quantity: 1,
              total: decimal("5000.00"),
              commissionModeSnapshot: "NONE",
              commissionValueSnapshot: decimal("9999.00"),
              commissionTotalSnapshot: decimal("0.00"),
            },
            {
              id: "missing",
              serviceId: "service_3",
              description: "Peinado",
              quantity: 1,
              total: decimal("7000.00"),
              commissionModeSnapshot: null,
              commissionValueSnapshot: null,
              commissionTotalSnapshot: null,
            },
          ],
        },
      ],
    });

    const report = await createStaffLiquidationService(repo).getReport(
      context,
      {
        from: "2026-07-27",
        to: "2026-07-28",
        staffMemberId: "staff_1",
      },
    );

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ staffMemberId: "staff_1" }),
    );
    expect(report.summaries[0]).toEqual(
      expect.objectContaining({
        soldTotal: "42000.00",
        commissionTotal: "3000.00",
        serviceLineCount: 3,
      }),
    );
  });

  it("calculates percentage commissions from persisted basis points", async () => {
    const repo = repository({
      sales: [
        {
          id: "sale_1",
          saleNumber: "V-1",
          completedAt: new Date("2026-07-27T15:00:00.000Z"),
          staffMemberId: "staff_1",
          staffMember: {
            displayName: "Sofía",
            firstName: "Sofía",
            lastName: "Paz",
          },
          client: null,
          items: [
            {
              id: "item_1",
              serviceId: "service_1",
              description: "Corte",
              quantity: 1,
              total: decimal("15000.00"),
              commissionModeSnapshot: "PERCENTAGE_BPS",
              commissionValueSnapshot: decimal("3000"),
              commissionTotalSnapshot: decimal("4500.00"),
            },
          ],
        },
      ],
    });

    const report = await createStaffLiquidationService(repo).getReport(
      context,
      {
        from: "2026-07-27",
        to: "2026-07-27",
        staffMemberId: "all",
      },
    );

    expect(report.summaries[0]).toEqual(
      expect.objectContaining({
        soldTotal: "15000.00",
        commissionTotal: "4500.00",
      }),
    );
  });

  it("groups sales by Colombia business day", async () => {
    const repo = repository({
      sales: [
        {
          id: "sale_1",
          saleNumber: "V-1",
          completedAt: new Date("2026-07-27T04:30:00.000Z"),
          staffMemberId: "staff_1",
          staffMember: {
            displayName: "Sofía",
            firstName: "Sofía",
            lastName: "Paz",
          },
          client: null,
          items: [
            {
              id: "item_1",
              serviceId: "service_1",
              description: "Corte nocturno",
              quantity: 1,
              total: decimal("10000.00"),
              commissionModeSnapshot: null,
              commissionValueSnapshot: null,
              commissionTotalSnapshot: null,
            },
          ],
        },
      ],
    });

    const report = await createStaffLiquidationService(repo).getReport(
      context,
      {
        from: "2026-07-26",
        to: "2026-07-26",
        staffMemberId: "all",
      },
    );

    expect(repo.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      from: new Date("2026-07-26T05:00:00.000Z"),
      toExclusive: new Date("2026-07-27T05:00:00.000Z"),
      staffMemberId: undefined,
    });
    expect(report.details[0]?.days[0]?.date).toBe("2026-07-26");
  });
});
