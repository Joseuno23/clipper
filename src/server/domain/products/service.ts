import { ApiError } from "../../api/errors";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  NormalizedProductCreateInput,
  NormalizedProductListInput,
  NormalizedProductUpdateInput,
  ProductDto,
  ProductRepository,
} from "./types";

export function createProductService(repository: ProductRepository) {
  return {
    async list(context: AuthContext, pagination: NormalizedProductListInput) {
      const records = await repository.list({
        barberShopId: context.tenant.barberShopId,
        pagination,
      });

      return records.map(toProductDto);
    },

    async create(context: AuthContext, data: NormalizedProductCreateInput) {
      requireAdminCapable(context);

      try {
        return toProductDto(
          await repository.create({
            barberShopId: context.tenant.barberShopId,
            data,
          }),
        );
      } catch (error) {
        throw mapProductWriteError(error);
      }
    },

    async get(context: AuthContext, id: string) {
      const record = await repository.findActiveById({
        barberShopId: context.tenant.barberShopId,
        id,
      });

      if (!record) {
        throw productNotFoundError();
      }

      return toProductDto(record);
    },

    async update(
      context: AuthContext,
      id: string,
      data: NormalizedProductUpdateInput,
    ) {
      requireAdminCapable(context);

      try {
        const record = await repository.update({
          barberShopId: context.tenant.barberShopId,
          id,
          data,
        });

        if (!record) {
          throw productNotFoundError();
        }

        return toProductDto(record);
      } catch (error) {
        throw mapProductWriteError(error);
      }
    },

    async delete(context: AuthContext, id: string, now = new Date()) {
      requireAdminCapable(context);
      const record = await repository.softDelete({
        barberShopId: context.tenant.barberShopId,
        id,
        deletedAt: now,
      });

      if (!record) {
        throw productNotFoundError();
      }

      return toProductDto(record);
    },
  };
}

export type ProductService = ReturnType<typeof createProductService>;

export function toProductDto(record: {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  price: { toString(): string };
  cost: { toString(): string } | null;
  currentStock: number;
  lowStockAt: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ProductDto {
  return {
    id: record.id,
    name: record.name,
    sku: record.sku,
    barcode: record.barcode,
    description: record.description,
    catalogPrice: record.price.toString(),
    cost: record.cost?.toString() ?? null,
    currentStock: record.currentStock,
    stock: record.currentStock,
    lowStockAt: record.lowStockAt,
    isActive: record.isActive,
    category: null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapProductWriteError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (isUniqueConstraintError(error)) {
    return new ApiError({
      code: "CONFLICT",
      message: "Product already exists for this barber shop.",
    });
  }

  return error;
}

function productNotFoundError() {
  return new ApiError({
    code: "NOT_FOUND",
    message: "Product was not found.",
  });
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
