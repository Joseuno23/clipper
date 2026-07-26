import { ApiError } from "../../api/errors";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  NormalizedStaffCreateInput,
  NormalizedStaffListInput,
  NormalizedStaffUpdateInput,
  StaffDto,
  StaffRepository,
} from "./types";

export function createStaffService(repository: StaffRepository) {
  return {
    async list(context: AuthContext, pagination: NormalizedStaffListInput) {
      const records = await repository.list({
        barberShopId: context.tenant.barberShopId,
        pagination,
      });

      return records.map(toStaffDto);
    },

    async create(context: AuthContext, data: NormalizedStaffCreateInput) {
      requireAdminCapable(context);

      try {
        return toStaffDto(
          await repository.create({
            barberShopId: context.tenant.barberShopId,
            data,
          }),
        );
      } catch (error) {
        throw mapStaffWriteError(error);
      }
    },

    async get(context: AuthContext, id: string) {
      const record = await repository.findActiveById({
        barberShopId: context.tenant.barberShopId,
        id,
      });

      if (!record) {
        throw staffNotFoundError();
      }

      return toStaffDto(record);
    },

    async update(
      context: AuthContext,
      id: string,
      data: NormalizedStaffUpdateInput,
    ) {
      requireAdminCapable(context);

      try {
        const record = await repository.update({
          barberShopId: context.tenant.barberShopId,
          id,
          data,
        });

        if (!record) {
          throw staffNotFoundError();
        }

        return toStaffDto(record);
      } catch (error) {
        throw mapStaffWriteError(error);
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
        throw staffNotFoundError();
      }

      return toStaffDto(record);
    },
  };
}

export type StaffService = ReturnType<typeof createStaffService>;

export function toStaffDto(record: {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  isActive: boolean;
  commissionMode: StaffDto["commissionMode"];
  commissionValue: { toString(): string };
  workingDays: number[];
  restDays: Date[];
  specialties: string[];
  createdAt: Date;
  updatedAt: Date;
  roles: { role: StaffDto["roles"][number] }[];
  serviceCommissions: {
    serviceId: string;
    commissionMode: StaffDto["serviceCommissions"][number]["commissionMode"];
    commissionValue: { toString(): string };
  }[];
}): StaffDto {
  return {
    id: record.id,
    userId: record.userId,
    firstName: record.firstName,
    lastName: record.lastName,
    displayName: record.displayName,
    email: record.email,
    normalizedEmail: record.normalizedEmail,
    phone: record.phone,
    normalizedPhone: record.normalizedPhone,
    isActive: record.isActive,
    commissionMode: record.commissionMode,
    commissionValue: record.commissionValue.toString(),
    workingDays: record.workingDays,
    restDays: record.restDays.map((date) => date.toISOString()),
    specialties: record.specialties,
    roles: record.roles.map(({ role }) => role),
    serviceCommissions: record.serviceCommissions.map((commission) => ({
      serviceId: commission.serviceId,
      commissionMode: commission.commissionMode,
      commissionValue: commission.commissionValue.toString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function mapStaffWriteError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (isUniqueConstraintError(error)) {
    return new ApiError({
      code: "CONFLICT",
      message: "Staff member already exists for this barber shop.",
    });
  }

  return error;
}

function staffNotFoundError() {
  return new ApiError({
    code: "NOT_FOUND",
    message: "Staff member was not found.",
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
