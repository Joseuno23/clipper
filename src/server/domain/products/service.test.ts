// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import { createProductService } from "./service";
import { parseProductCreateInput, parseProductUpdateInput } from "./validation";
import type { ProductRecord, ProductRepository } from "./types";

const baseContext = {
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
} as const;

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

function createRepository(): ProductRepository {
  return {
    list: vi.fn(async () => [createRecord()]),
    create: vi.fn(async ({ data, barberShopId }) =>
      createRecord({
        barberShopId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        description: data.description,
        price: { toString: () => data.catalogPrice },
        cost: data.cost === null ? null : { toString: () => data.cost ?? "" },
        currentStock: data.stock,
        lowStockAt: data.lowStockAt,
        isActive: data.isActive,
      }),
    ),
    findActiveById: vi.fn(async () => createRecord()),
    update: vi.fn(async ({ data }) =>
      createRecord({
        ...data,
        price: { toString: () => data.catalogPrice ?? "2500.00" },
        currentStock: data.stock ?? 10,
      }),
    ),
    softDelete: vi.fn(async ({ deletedAt }) =>
      createRecord({ deletedAt, isActive: false }),
    ),
  };
}

describe("product service", () => {
  let repository: ProductRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("lists active products scoped to the authenticated tenant", async () => {
    const service = createProductService(repository);

    await service.list(baseContext, { limit: 50, offset: 0 });

    expect(repository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 50, offset: 0 },
    });
  });

  it("normalizes create input, sku, optional category, price, stock, and active flag", async () => {
    const service = createProductService(repository);
    const data = parseProductCreateInput({
      name: " Pomade   Matte ",
      sku: " pom-001 ",
      description: " Strong hold ",
      category: " Styling ",
      catalogPrice: "2500",
      stock: "10",
      active: false,
    });

    const created = await service.create(baseContext, data);

    expect(repository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: {
        name: "Pomade Matte",
        sku: "POM-001",
        barcode: null,
        description: "Strong hold",
        category: "Styling",
        catalogPrice: "2500.00",
        cost: null,
        stock: 10,
        lowStockAt: null,
        isActive: false,
      },
    });
    expect(created).toEqual(
      expect.objectContaining({
        catalogPrice: "2500.00",
        stock: 10,
        isActive: false,
        createdAt: now.toISOString(),
      }),
    );
    expect(created).not.toHaveProperty("barberShopId");
  });

  it("rejects non-positive price and negative stock with field-safe errors", () => {
    expect(() =>
      parseProductCreateInput({
        name: "Pomade",
        catalogPrice: "0",
        stock: 1,
      }),
    ).toThrow(ApiError);

    expect(() =>
      parseProductCreateInput({
        name: "Pomade",
        catalogPrice: "10.00",
        stock: -1,
      }),
    ).toThrow(ApiError);
  });

  it("maps duplicate product names, skus, or barcodes to conflict", async () => {
    repository.create = vi.fn(async () => {
      throw { code: "P2002" };
    });
    const service = createProductService(repository);

    await expect(
      service.create(
        baseContext,
        parseProductCreateInput({
          name: "Pomade",
          catalogPrice: "2500.00",
          stock: 10,
        }),
      ),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Product already exists for this barber shop.",
      }),
    );
  });

  it("rejects non-admin mutations", async () => {
    const service = createProductService(repository);

    await expect(
      service.create(
        {
          ...baseContext,
          membership: { ...baseContext.membership, role: "STAFF" },
        },
        parseProductCreateInput({
          name: "Pomade",
          catalogPrice: "2500.00",
          stock: 10,
        }),
      ),
    ).rejects.toThrow(
      new ApiError({ code: "FORBIDDEN", message: "Admin access is required." }),
    );
  });

  it("updates stock and soft deletes active products only", async () => {
    const service = createProductService(repository);

    await service.update(
      baseContext,
      "product_1",
      parseProductUpdateInput({ stock: "12", catalogPrice: "2700" }),
    );
    await service.delete(baseContext, "product_1", now);

    expect(repository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "product_1",
      data: { stock: 12, catalogPrice: "2700.00" },
    });
    expect(repository.softDelete).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "product_1",
      deletedAt: now,
    });
  });
});
