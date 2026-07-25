import { ApiError } from "../../api/errors";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  NormalizedServiceCreateInput,
  NormalizedServiceListInput,
  NormalizedServiceUpdateInput,
  ServiceDto,
  ServiceRepository,
} from "./types";

export function createServiceService(repository: ServiceRepository) {
  return {
    async list(context: AuthContext, pagination: NormalizedServiceListInput) {
      const records = await repository.list({
        barberShopId: context.tenant.barberShopId,
        pagination,
      });

      return records.map(toServiceDto);
    },

    async create(context: AuthContext, data: NormalizedServiceCreateInput) {
      requireAdminCapable(context);

      try {
        return toServiceDto(
          await repository.create({
            barberShopId: context.tenant.barberShopId,
            data,
          }),
        );
      } catch (error) {
        throw mapServiceWriteError(error);
      }
    },

    async get(context: AuthContext, id: string) {
      const record = await repository.findActiveById({
        barberShopId: context.tenant.barberShopId,
        id,
      });

      if (!record) {
        throw serviceNotFoundError();
      }

      return toServiceDto(record);
    },

    async update(
      context: AuthContext,
      id: string,
      data: NormalizedServiceUpdateInput,
    ) {
      requireAdminCapable(context);

      try {
        const record = await repository.update({
          barberShopId: context.tenant.barberShopId,
          id,
          data,
        });

        if (!record) {
          throw serviceNotFoundError();
        }

        return toServiceDto(record);
      } catch (error) {
        throw mapServiceWriteError(error);
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
        throw serviceNotFoundError();
      }

      return toServiceDto(record);
    },
  };
}

export type ServiceService = ReturnType<typeof createServiceService>;

export function toServiceDto(record: {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: { toString(): string };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  allowedRoles: { role: ServiceDto["allowedRoles"][number] }[];
}): ServiceDto {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    durationMinutes: record.durationMinutes,
    basePrice: record.price.toString(),
    isActive: record.isActive,
    allowedRoles: record.allowedRoles.map(({ role }) => role),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapServiceWriteError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (isUniqueConstraintError(error)) {
    return new ApiError({
      code: "CONFLICT",
      message: "Service already exists for this barber shop.",
    });
  }

  return error;
}

function serviceNotFoundError() {
  return new ApiError({
    code: "NOT_FOUND",
    message: "Service was not found.",
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
