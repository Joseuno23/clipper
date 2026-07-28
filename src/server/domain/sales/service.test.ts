// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import { createSaleService } from "./service";
import type { SaleRecord, SaleRepository } from "./types";

const context = {
  user: {
    id: "user_1",
    email: "admin@test.dev",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    name: "Niche 72",
    slug: "clipper",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
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

const now = new Date("2026-07-27T10:00:00.000Z");

function sale(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    id: "sale_1",
    appointmentId: null,
    clientId: null,
    staffMemberId: null,
    saleNumber: "V-1",
    status: "DRAFT",
    subtotal: { toString: () => "1000.00" },
    discountTotal: { toString: () => "0.00" },
    taxTotal: { toString: () => "0.00" },
    total: { toString: () => "1000.00" },
    businessDate: now,
    completedAt: null,
    cancellationReason: null,
    createdAt: now,
    updatedAt: now,
    client: null,
    staffMember: null,
    appointment: null,
    items: [
      {
        id: "item_1",
        kind: "SERVICE",
        serviceId: "service_1",
        productId: null,
        description: "Classic Cut",
        quantity: 1,
        unitPrice: { toString: () => "1000.00" },
        discountAmount: { toString: () => "0.00" },
        total: { toString: () => "1000.00" },
      },
    ],
    payments: [],
    ...overrides,
  };
}

function repository(): SaleRepository {
  return {
    list: vi.fn(async () => [
      sale(),
      sale({ id: "sale_2", status: "COMPLETED" }),
    ]),
    createManualDraft: vi.fn(async () =>
      sale({
        items: [],
        subtotal: { toString: () => "0" },
        total: { toString: () => "0" },
      }),
    ),
    findById: vi.fn(async () => sale()),
    addServiceItem: vi.fn(async () => sale()),
    addProductItem: vi.fn(async () => sale()),
    updateItemQuantity: vi.fn(async () => sale()),
    removeItem: vi.fn(async () => sale({ items: [] })),
    complete: vi.fn(async ({ method }) =>
      sale({
        status: "COMPLETED",
        completedAt: now,
        payments: [
          {
            id: "payment_1",
            method,
            amount: { toString: () => "1000.00" },
            reference: null,
            paidAt: now,
          },
        ],
      }),
    ),
    cancel: vi.fn(async ({ reason }) =>
      sale({ status: "CANCELLED", cancellationReason: reason }),
    ),
  };
}

describe("sale service", () => {
  let repo: SaleRepository;

  beforeEach(() => {
    repo = repository();
  });

  it("lists open and closed cashier orders as sale DTOs", async () => {
    const service = createSaleService(repo);

    const result = await service.list(context, { status: "all" });

    expect(repo.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      status: "all",
      date: undefined,
      limit: 25,
      offset: 0,
    });
    expect(result.map((item) => item.statusGroup)).toEqual(["open", "closed"]);
  });

  it("defaults payment completion to transfer", async () => {
    const service = createSaleService(repo);

    const result = await service.complete(context, "sale_1", {}, now);

    expect(repo.complete).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      method: "TRANSFER",
      reference: null,
      paidAt: now,
    });
    expect(result.payments[0]?.method).toBe("TRANSFER");
  });

  it("cancels a draft sale with a required reason", async () => {
    const service = createSaleService(repo);

    const result = await service.cancel(context, "sale_1", {
      reason: "Cliente canceló",
    });

    expect(repo.cancel).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      reason: "Cliente canceló",
    });
    expect(result.status).toBe("CANCELLED");
    expect(result.statusGroup).toBe("cancelled");
  });

  it("creates a manual draft and routes product-only checkout mutations", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    const service = createSaleService(repo);

    try {
      await service.createManualDraft(context, {
        clientId: null,
        staffMemberId: "staff_1",
      });
      const productSale = await service.update(context, "sale_1", {
        action: "addItem",
        kind: "PRODUCT",
        productId: "product_1",
        quantity: 2,
      });
      await service.complete(context, "sale_1", {}, now);

      expect(repo.createManualDraft).toHaveBeenCalledWith({
        barberShopId: "shop_1",
        data: { clientId: null, staffMemberId: "staff_1" },
        businessDate: new Date("2026-07-27T12:00:00.000Z"),
      });
      expect(repo.addProductItem).toHaveBeenCalledWith({
        barberShopId: "shop_1",
        saleId: "sale_1",
        productId: "product_1",
        quantity: 2,
      });
      expect(repo.addServiceItem).not.toHaveBeenCalled();
      expect(productSale.clientName).toBe("Venta manual");
      expect(repo.complete).toHaveBeenCalledWith(
        expect.objectContaining({ saleId: "sale_1", method: "TRANSFER" }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses the appointment client when a linked sale has no direct client", async () => {
    repo.list = vi.fn(async () => [
      sale({
        appointmentId: "appointment_1",
        clientId: null,
        client: null,
        appointment: {
          id: "appointment_1",
          queueStatus: "WAITING",
          client: { firstName: "Bruno", lastName: "Díaz" },
        },
      }),
    ]);
    const service = createSaleService(repo);

    const [result] = await service.list(context, { status: "open" });

    expect(result?.clientName).toBe("Bruno Díaz");
  });

  it("routes draft service additions and item removals through repository mutations", async () => {
    const service = createSaleService(repo);

    await service.update(context, "sale_1", {
      action: "addItem",
      kind: "SERVICE",
      serviceId: "service_1",
    });
    await service.update(context, "sale_1", {
      action: "removeItem",
      itemId: "item_1",
    });

    expect(repo.addServiceItem).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      serviceId: "service_1",
      quantity: 1,
    });
    expect(repo.removeItem).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      itemId: "item_1",
    });
  });

  it("rejects service item quantities other than one before repository mutation", async () => {
    const service = createSaleService(repo);

    await expect(
      service.update(context, "sale_1", {
        action: "addItem",
        kind: "SERVICE",
        serviceId: "service_1",
        quantity: 5,
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Service sale items must have quantity 1.",
      }),
    );

    expect(repo.addServiceItem).not.toHaveBeenCalled();
  });

  it("raises not found when repository cannot find a sale", async () => {
    repo.findById = vi.fn(async () => null);
    const service = createSaleService(repo);

    await expect(service.get(context, "missing")).rejects.toBeInstanceOf(
      ApiError,
    );
  });
});
