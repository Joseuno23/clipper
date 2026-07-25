// @vitest-environment node

import "dotenv/config";

import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { prisma as PrismaSingleton } from "../db/client";
import type { clientRepository as ClientRepositorySingleton } from "./clientRepository";
import type { productRepository as ProductRepositorySingleton } from "./productRepository";
import type { serviceRepository as ServiceRepositorySingleton } from "./serviceRepository";

type PrismaClient = typeof PrismaSingleton;
type ClientRepository = typeof ClientRepositorySingleton;
type ProductRepository = typeof ProductRepositorySingleton;
type ServiceRepository = typeof ServiceRepositorySingleton;

const hasDatabaseUrl = Boolean(process.env["DATABASE_URL"]);

describe.skipIf(!hasDatabaseUrl)("admin CRUD repository filters", () => {
  let prisma: PrismaClient;
  let clientRepository: ClientRepository;
  let productRepository: ProductRepository;
  let serviceRepository: ServiceRepository;
  let firstShopId: string;
  let secondShopId: string;

  const createdShopIds: string[] = [];
  const runId = `repo-filter-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    [
      { prisma },
      { clientRepository },
      { productRepository },
      { serviceRepository },
    ] = await Promise.all([
      import("../db/client"),
      import("./clientRepository"),
      import("./productRepository"),
      import("./serviceRepository"),
    ]);

    await prisma.$connect();
  });

  beforeEach(async () => {
    const [firstShop, secondShop] = await Promise.all([
      prisma.barberShop.create({
        data: {
          name: `${runId} Shop A`,
          slug: `${runId}-a`,
          timezone: "America/Argentina/Buenos_Aires",
        },
      }),
      prisma.barberShop.create({
        data: {
          name: `${runId} Shop B`,
          slug: `${runId}-b`,
          timezone: "America/Argentina/Buenos_Aires",
        },
      }),
    ]);

    firstShopId = firstShop.id;
    secondShopId = secondShop.id;
    createdShopIds.push(firstShopId, secondShopId);
  });

  afterEach(async () => {
    if (createdShopIds.length === 0) {
      return;
    }

    await prisma.product.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.serviceAllowedRole.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.service.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.client.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.barberShop.deleteMany({
      where: { id: { in: createdShopIds } },
    });
    createdShopIds.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("scopes client list/get by shop and excludes soft-deleted rows", async () => {
    const visibleClient = await clientRepository.create({
      barberShopId: firstShopId,
      data: clientData("Visible", "Client", "visible"),
    });
    const deletedClient = await clientRepository.create({
      barberShopId: firstShopId,
      data: clientData("Deleted", "Client", "deleted"),
    });
    const crossShopClient = await clientRepository.create({
      barberShopId: secondShopId,
      data: clientData("Other", "Tenant", "other"),
    });

    await clientRepository.softDelete({
      barberShopId: firstShopId,
      id: deletedClient.id,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    const firstShopClients = await clientRepository.list({
      barberShopId: firstShopId,
      pagination: { limit: 20, offset: 0 },
    });

    expect(firstShopClients.map(({ id }) => id)).toEqual([visibleClient.id]);
    await expect(
      clientRepository.findActiveById({
        barberShopId: firstShopId,
        id: deletedClient.id,
      }),
    ).resolves.toBeNull();
    await expect(
      clientRepository.findActiveById({
        barberShopId: firstShopId,
        id: crossShopClient.id,
      }),
    ).resolves.toBeNull();
  });

  it("scopes service list/get by shop and excludes inactive or soft-deleted rows", async () => {
    const visibleService = await serviceRepository.create({
      barberShopId: firstShopId,
      data: serviceData("Visible Service"),
    });
    const deletedService = await serviceRepository.create({
      barberShopId: firstShopId,
      data: serviceData("Deleted Service"),
    });
    const inactiveService = await serviceRepository.create({
      barberShopId: firstShopId,
      data: serviceData("Inactive Service"),
    });
    const crossShopService = await serviceRepository.create({
      barberShopId: secondShopId,
      data: serviceData("Other Tenant Service"),
    });

    await serviceRepository.softDelete({
      barberShopId: firstShopId,
      id: deletedService.id,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await prisma.service.update({
      where: { id: inactiveService.id },
      data: { isActive: false },
    });

    const firstShopServices = await serviceRepository.list({
      barberShopId: firstShopId,
      pagination: { limit: 20, offset: 0 },
    });

    expect(firstShopServices.map(({ id }) => id)).toEqual([visibleService.id]);
    await expect(
      serviceRepository.findActiveById({
        barberShopId: firstShopId,
        id: deletedService.id,
      }),
    ).resolves.toBeNull();
    await expect(
      serviceRepository.findActiveById({
        barberShopId: firstShopId,
        id: inactiveService.id,
      }),
    ).resolves.toBeNull();
    await expect(
      serviceRepository.findActiveById({
        barberShopId: firstShopId,
        id: crossShopService.id,
      }),
    ).resolves.toBeNull();
  });

  it("scopes product list/get by shop and excludes inactive or soft-deleted rows", async () => {
    const visibleProduct = await productRepository.create({
      barberShopId: firstShopId,
      data: productData("Visible Product", "VISIBLE"),
    });
    const deletedProduct = await productRepository.create({
      barberShopId: firstShopId,
      data: productData("Deleted Product", "DELETED"),
    });
    const inactiveProduct = await productRepository.create({
      barberShopId: firstShopId,
      data: productData("Inactive Product", "INACTIVE"),
    });
    const crossShopProduct = await productRepository.create({
      barberShopId: secondShopId,
      data: productData("Other Tenant Product", "OTHER"),
    });

    await productRepository.softDelete({
      barberShopId: firstShopId,
      id: deletedProduct.id,
      deletedAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    await prisma.product.update({
      where: { id: inactiveProduct.id },
      data: { isActive: false },
    });

    const firstShopProducts = await productRepository.list({
      barberShopId: firstShopId,
      pagination: { limit: 20, offset: 0 },
    });

    expect(firstShopProducts.map(({ id }) => id)).toEqual([visibleProduct.id]);
    await expect(
      productRepository.findActiveById({
        barberShopId: firstShopId,
        id: deletedProduct.id,
      }),
    ).resolves.toBeNull();
    await expect(
      productRepository.findActiveById({
        barberShopId: firstShopId,
        id: inactiveProduct.id,
      }),
    ).resolves.toBeNull();
    await expect(
      productRepository.findActiveById({
        barberShopId: firstShopId,
        id: crossShopProduct.id,
      }),
    ).resolves.toBeNull();
  });

  function clientData(firstName: string, lastName: string, suffix: string) {
    const unique = `${runId}-${suffix}`;

    return {
      firstName,
      lastName,
      email: `${unique}@example.test`,
      normalizedEmail: `${unique}@example.test`,
      phone: null,
      normalizedPhone: null,
      documentNumber: unique.toUpperCase(),
      normalizedDocument: unique.toUpperCase(),
      notes: null,
      isBlocked: false,
    };
  }

  function serviceData(name: string) {
    return {
      name: `${runId} ${name}`,
      description: null,
      durationMinutes: 30,
      basePrice: "1000.00",
      allowedRoles: [],
    };
  }

  function productData(name: string, skuSuffix: string) {
    return {
      name: `${runId} ${name}`,
      sku: `${runId}-${skuSuffix}`,
      barcode: null,
      description: null,
      category: null,
      catalogPrice: "5000.00",
      cost: null,
      stock: 10,
      lowStockAt: null,
      isActive: true,
    };
  }
});
