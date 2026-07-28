// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SaleRecord } from "../../src/server/domain/sales/types";
import { getApiRoute } from "../../vite.config";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const saleRepository = {
  list: vi.fn(),
  createManualDraft: vi.fn(),
  findById: vi.fn(),
  addServiceItem: vi.fn(),
  addProductItem: vi.fn(),
  updateItemQuantity: vi.fn(),
  removeItem: vi.fn(),
  complete: vi.fn(),
  cancel: vi.fn(),
};

vi.mock("../../src/server/api/auth", () => ({
  getAuthContext,
  requireAdminCapable,
}));

vi.mock("../../src/server/repositories/saleRepository", () => ({
  saleRepository,
}));

const authContext = {
  user: {
    id: "user_1",
    email: "admin@clipper.test",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
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
};

const now = new Date("2026-07-27T10:00:00.000Z");

function decimal(value: string) {
  return { toString: () => value };
}

function createRecord(overrides: Partial<SaleRecord> = {}): SaleRecord {
  return {
    id: "sale_1",
    appointmentId: null,
    clientId: null,
    staffMemberId: null,
    saleNumber: "V-1",
    status: "DRAFT",
    subtotal: decimal("5000.00"),
    discountTotal: decimal("0.00"),
    taxTotal: decimal("0.00"),
    total: decimal("5000.00"),
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
        kind: "PRODUCT",
        serviceId: null,
        productId: "product_1",
        description: "Pomade",
        quantity: 2,
        unitPrice: decimal("2500.00"),
        discountAmount: decimal("0.00"),
        total: decimal("5000.00"),
      },
    ],
    payments: [],
    ...overrides,
  };
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(status: number) {
      this.statusCode = status;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as VercelResponse & typeof response;
}

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    ...overrides,
  } as VercelRequest;
}

describe("sales API handlers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    saleRepository.list.mockReset().mockResolvedValue([createRecord()]);
    saleRepository.createManualDraft.mockReset().mockResolvedValue(
      createRecord({
        items: [],
        subtotal: decimal("0.00"),
        total: decimal("0.00"),
      }),
    );
    saleRepository.findById.mockReset().mockResolvedValue(createRecord());
    saleRepository.addServiceItem.mockReset().mockResolvedValue(createRecord());
    saleRepository.addProductItem.mockReset().mockResolvedValue(createRecord());
    saleRepository.updateItemQuantity
      .mockReset()
      .mockResolvedValue(createRecord());
    saleRepository.removeItem
      .mockReset()
      .mockResolvedValue(createRecord({ items: [] }));
    saleRepository.complete.mockReset().mockResolvedValue(
      createRecord({
        status: "COMPLETED",
        completedAt: now,
        payments: [
          {
            id: "payment_1",
            method: "TRANSFER",
            amount: decimal("5000.00"),
            reference: null,
            paidAt: now,
          },
        ],
      }),
    );
    saleRepository.cancel.mockReset().mockResolvedValue(
      createRecord({
        status: "CANCELLED",
        cancellationReason: "Cliente pidió cancelar",
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes bounded day pagination params to the sales list service", async () => {
    const { default: indexHandler } = await import("./index");
    const response = createResponse();

    await indexHandler(
      createRequest({
        method: "GET",
        query: {
          status: "cancelled",
          date: "2026-07-27",
          limit: "25",
          offset: "50",
        },
      }),
      response,
    );

    expect(saleRepository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      status: "cancelled",
      date: "2026-07-27",
      limit: 25,
      offset: 50,
    });
    expect(response.body).toEqual({ ok: true, data: expect.any(Array) });
  });

  it("creates a manual draft and adds a product item through the sales endpoints", async () => {
    const { default: indexHandler } = await import("./index");
    const createResponseBody = createResponse();

    await indexHandler(
      createRequest({ method: "POST", body: { staffMemberId: "staff_1" } }),
      createResponseBody,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(saleRepository.createManualDraft).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: { staffMemberId: "staff_1" },
      businessDate: new Date("2026-07-27T12:00:00.000Z"),
    });

    const { default: idHandler } = await import("./[id]");
    const patchResponse = createResponse();

    await idHandler(
      createRequest({
        method: "PATCH",
        query: { id: "sale_1" },
        body: {
          action: "addItem",
          kind: "PRODUCT",
          productId: "product_1",
          quantity: 2,
        },
      }),
      patchResponse,
    );

    expect(saleRepository.addProductItem).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      productId: "product_1",
      quantity: 2,
    });
    expect(patchResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        clientName: "Venta manual",
        items: [expect.objectContaining({ kind: "PRODUCT", total: "5000.00" })],
        total: "5000.00",
      }),
    });
  });

  it("removes draft items and completes the order with transfer default", async () => {
    const { default: idHandler } = await import("./[id]");

    await idHandler(
      createRequest({
        method: "PATCH",
        query: { id: "sale_1" },
        body: { action: "removeItem", itemId: "item_1" },
      }),
      createResponse(),
    );

    expect(saleRepository.removeItem).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      itemId: "item_1",
    });

    const { default: paymentHandler } = await import("./[id]/payments");
    const paymentResponse = createResponse();

    await paymentHandler(
      createRequest({ method: "POST", query: { id: "sale_1" }, body: {} }),
      paymentResponse,
    );

    expect(saleRepository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        saleId: "sale_1",
        method: "TRANSFER",
        reference: null,
      }),
    );
    expect(paymentResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: "COMPLETED",
        payments: [expect.objectContaining({ method: "TRANSFER" })],
      }),
    });
  });

  it("routes POST /api/sales/:id/payments and completes with transfer default", async () => {
    const apiRoute = getApiRoute("/api/sales/sale_1/payments");

    expect(apiRoute).toEqual({
      modulePath: expect.stringContaining("api/sales/[id]/payments.ts"),
      params: { id: "sale_1" },
    });

    if (!apiRoute) {
      throw new Error("Expected payments route to resolve.");
    }

    const { default: paymentHandler } = await import("./[id]/payments");
    const paymentResponse = createResponse();

    await paymentHandler(
      createRequest({
        method: "POST",
        url: "/api/sales/sale_1/payments",
        query: apiRoute.params,
        body: {},
      }),
      paymentResponse,
    );

    expect(saleRepository.complete).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        saleId: "sale_1",
        method: "TRANSFER",
        reference: null,
      }),
    );
    expect(paymentResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: "COMPLETED",
        payments: [expect.objectContaining({ method: "TRANSFER" })],
      }),
    });
  });

  it("routes POST /api/sales/:id/cancel and requires a cancellation reason", async () => {
    const apiRoute = getApiRoute("/api/sales/sale_1/cancel");

    expect(apiRoute).toEqual({
      modulePath: expect.stringContaining("api/sales/[id]/cancel.ts"),
      params: { id: "sale_1" },
    });

    const { default: cancelHandler } = await import("./[id]/cancel");
    const emptyReasonResponse = createResponse();

    await cancelHandler(
      createRequest({
        method: "POST",
        url: "/api/sales/sale_1/cancel",
        query: apiRoute!.params,
        body: { reason: " " },
      }),
      emptyReasonResponse,
    );

    expect(emptyReasonResponse.statusCode).toBe(400);
    expect(saleRepository.cancel).not.toHaveBeenCalled();

    const cancelResponse = createResponse();
    await cancelHandler(
      createRequest({
        method: "POST",
        url: "/api/sales/sale_1/cancel",
        query: apiRoute!.params,
        body: { reason: " Cliente pidió cancelar " },
      }),
      cancelResponse,
    );

    expect(saleRepository.cancel).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      reason: "Cliente pidió cancelar",
    });
    expect(cancelResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: "CANCELLED",
        statusGroup: "cancelled",
        cancellationReason: "Cliente pidió cancelar",
      }),
    });
  });

  it("updates item quantity and rejects quantities below one", async () => {
    const { default: idHandler } = await import("./[id]");
    const updateResponse = createResponse();

    await idHandler(
      createRequest({
        method: "PATCH",
        query: { id: "sale_1" },
        body: {
          action: "updateItemQuantity",
          itemId: "item_1",
          quantity: 4,
        },
      }),
      updateResponse,
    );

    expect(saleRepository.updateItemQuantity).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      saleId: "sale_1",
      itemId: "item_1",
      quantity: 4,
    });
    expect(updateResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({ total: "5000.00" }),
    });

    const invalidResponse = createResponse();

    await idHandler(
      createRequest({
        method: "PATCH",
        query: { id: "sale_1" },
        body: {
          action: "updateItemQuantity",
          itemId: "item_1",
          quantity: 0,
        },
      }),
      invalidResponse,
    );

    expect(invalidResponse.statusCode).toBe(400);
    expect(invalidResponse.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "BAD_REQUEST" }),
    });
  });

  it("rejects service item quantities other than one at the API boundary", async () => {
    const { default: idHandler } = await import("./[id]");
    const response = createResponse();

    await idHandler(
      createRequest({
        method: "PATCH",
        query: { id: "sale_1" },
        body: {
          action: "addItem",
          kind: "SERVICE",
          serviceId: "service_1",
          quantity: 5,
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: expect.objectContaining({
        code: "BAD_REQUEST",
        details: {
          fields: [
            {
              field: "quantity",
              message: "Service sale items must have quantity 1.",
            },
          ],
        },
      }),
    });
    expect(saleRepository.addServiceItem).not.toHaveBeenCalled();
  });
});
