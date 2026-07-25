// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProductRecord } from "../../src/server/domain/products/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const productRepository = {
  list: vi.fn(),
  create: vi.fn(),
  findActiveById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

vi.mock("../../src/server/api/auth", () => ({
  getAuthContext,
  requireAdminCapable,
}));

vi.mock("../../src/server/repositories/productRepository", () => ({
  productRepository,
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
    slug: "niche-72",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
  },
  membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
  tokenClaims: {
    sub: "user_1",
    barberShopId: "shop_1",
    barberShopSlug: "niche-72",
    role: "OWNER",
    membershipStatus: "ACTIVE",
    typ: "access",
  },
};

const now = new Date("2026-01-01T00:00:00.000Z");

function createRecord(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product_1",
    barberShopId: "shop_1",
    name: "Pomade",
    sku: "POM-001",
    barcode: null,
    description: "Strong hold",
    price: { toString: () => "2500.00" },
    cost: null,
    currentStock: 10,
    lowStockAt: 2,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
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

describe("products API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    productRepository.list.mockReset().mockResolvedValue([createRecord()]);
    productRepository.create.mockReset().mockResolvedValue(createRecord());
    productRepository.findActiveById
      .mockReset()
      .mockResolvedValue(createRecord());
    productRepository.update
      .mockReset()
      .mockResolvedValue(createRecord({ name: "Pomade Updated" }));
    productRepository.softDelete
      .mockReset()
      .mockResolvedValue(createRecord({ deletedAt: now, isActive: false }));
  });

  it("lists products scoped from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { limit: "10" } }),
      response,
    );

    expect(productRepository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 10, offset: 0 },
    });
    expect(response.body).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: "product_1", stock: 10 })],
    });
  });

  it("creates products with admin guard and normalized payload", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          name: " Pomade   Matte ",
          sku: " pom-001 ",
          description: " Strong hold ",
          catalogPrice: "2500",
          stock: "10",
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(productRepository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({
        name: "Pomade Matte",
        sku: "POM-001",
        description: "Strong hold",
        catalogPrice: "2500.00",
        stock: 10,
      }),
    });
    expect(response.statusCode).toBe(200);
  });

  it("gets, updates, and deletes products by path id", async () => {
    const { default: handler } = await import("./[id]");

    const getResponse = createResponse();
    await handler(
      createRequest({ method: "GET", query: { id: "product_1" } }),
      getResponse,
    );
    expect(productRepository.findActiveById).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "product_1",
    });

    const patchResponse = createResponse();
    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "product_1" },
        body: { stock: "12", catalogPrice: "2700" },
      }),
      patchResponse,
    );
    expect(productRepository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "product_1",
      data: { catalogPrice: "2700.00", stock: 12 },
    });

    const deleteResponse = createResponse();
    await handler(
      createRequest({ method: "DELETE", query: { id: "product_1" } }),
      deleteResponse,
    );
    expect(productRepository.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1", id: "product_1" }),
    );
  });

  it("returns a safe forbidden envelope when admin guard rejects mutation", async () => {
    const { ApiError } = await import("../../src/server/api/errors");

    requireAdminCapable.mockImplementationOnce(() => {
      throw new ApiError({
        code: "FORBIDDEN",
        message: "Admin access is required.",
      });
    });
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: { name: "Pomade", catalogPrice: "2500", stock: 10 },
      }),
      response,
    );

    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin access is required.",
      },
    });
  });
});
