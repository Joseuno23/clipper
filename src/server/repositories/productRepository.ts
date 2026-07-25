import { prisma } from "../db/client";
import type {
  NormalizedProductUpdateInput,
  ProductRepository,
} from "../domain/products/types";

export const productRepository: ProductRepository = {
  async list({ barberShopId, pagination }) {
    return prisma.product.findMany({
      where: { barberShopId, deletedAt: null, isActive: true },
      orderBy: [{ name: "asc" }],
      take: pagination.limit,
      skip: pagination.offset,
    });
  },

  async create({ barberShopId, data }) {
    return prisma.product.create({
      data: {
        barberShopId,
        name: data.name,
        sku: data.sku,
        barcode: data.barcode,
        description: data.description,
        price: data.catalogPrice,
        cost: data.cost,
        currentStock: data.stock,
        lowStockAt: data.lowStockAt,
        isActive: data.isActive,
      },
    });
  },

  async findActiveById({ barberShopId, id }) {
    return prisma.product.findFirst({
      where: { id, barberShopId, deletedAt: null, isActive: true },
    });
  },

  async update({ barberShopId, id, data }) {
    const existing = await prisma.product.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.product.update({
      where: { id },
      data: toProductUpdateData(data),
    });
  },

  async softDelete({ barberShopId, id, deletedAt }) {
    const existing = await prisma.product.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.product.update({
      where: { id },
      data: { deletedAt, isActive: false },
    });
  },
};

function toProductUpdateData(data: NormalizedProductUpdateInput) {
  return {
    ...(data.name === undefined ? {} : { name: data.name }),
    ...(data.sku === undefined ? {} : { sku: data.sku }),
    ...(data.barcode === undefined ? {} : { barcode: data.barcode }),
    ...(data.description === undefined
      ? {}
      : { description: data.description }),
    ...(data.catalogPrice === undefined ? {} : { price: data.catalogPrice }),
    ...(data.cost === undefined ? {} : { cost: data.cost }),
    ...(data.stock === undefined ? {} : { currentStock: data.stock }),
    ...(data.lowStockAt === undefined ? {} : { lowStockAt: data.lowStockAt }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
  };
}
