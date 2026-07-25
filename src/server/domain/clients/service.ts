import { ApiError } from "../../api/errors";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  ClientDto,
  ClientRepository,
  NormalizedClientCreateInput,
  NormalizedClientListInput,
  NormalizedClientUpdateInput,
} from "./types";

export function createClientService(repository: ClientRepository) {
  return {
    async list(context: AuthContext, pagination: NormalizedClientListInput) {
      const records = await repository.list({
        barberShopId: context.tenant.barberShopId,
        pagination,
      });

      return records.map(toClientDto);
    },

    async create(context: AuthContext, data: NormalizedClientCreateInput) {
      requireAdminCapable(context);

      try {
        return toClientDto(
          await repository.create({
            barberShopId: context.tenant.barberShopId,
            data,
          }),
        );
      } catch (error) {
        throw mapClientWriteError(error);
      }
    },

    async get(context: AuthContext, id: string) {
      const record = await repository.findActiveById({
        barberShopId: context.tenant.barberShopId,
        id,
      });

      if (!record) {
        throw clientNotFoundError();
      }

      return toClientDto(record);
    },

    async update(
      context: AuthContext,
      id: string,
      data: NormalizedClientUpdateInput,
    ) {
      requireAdminCapable(context);

      try {
        const record = await repository.update({
          barberShopId: context.tenant.barberShopId,
          id,
          data,
        });

        if (!record) {
          throw clientNotFoundError();
        }

        return toClientDto(record);
      } catch (error) {
        throw mapClientWriteError(error);
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
        throw clientNotFoundError();
      }

      return toClientDto(record);
    },
  };
}

export type ClientService = ReturnType<typeof createClientService>;

export function toClientDto(record: {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  documentNumber: string | null;
  normalizedDocument: string | null;
  notes: string | null;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}): ClientDto {
  return {
    id: record.id,
    firstName: record.firstName,
    lastName: record.lastName,
    email: record.email,
    normalizedEmail: record.normalizedEmail,
    phone: record.phone,
    normalizedPhone: record.normalizedPhone,
    documentNumber: record.documentNumber,
    normalizedDocument: record.normalizedDocument,
    notes: record.notes,
    isBlocked: record.isBlocked,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapClientWriteError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (isUniqueConstraintError(error)) {
    return new ApiError({
      code: "CONFLICT",
      message: "Client already exists for this barber shop.",
    });
  }

  return error;
}

function clientNotFoundError() {
  return new ApiError({
    code: "NOT_FOUND",
    message: "Client was not found.",
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
