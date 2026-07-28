import { prisma } from "../db/client";
import { ApiError } from "../api/errors";
import type { StaffRole } from "../../generated/prisma/enums";
import type {
  NormalizedStaffServiceCommissionInput,
  NormalizedStaffUpdateInput,
  StaffRepository,
} from "../domain/staff/types";

const staffInclude = {
  roles: { orderBy: { role: "asc" as const } },
  serviceCommissions: { orderBy: { serviceId: "asc" as const } },
};

export const staffRepository: StaffRepository = {
  async list({ barberShopId, pagination }) {
    return prisma.staffMember.findMany({
      where: { barberShopId, deletedAt: null, isActive: true },
      include: staffInclude,
      orderBy: [
        { displayName: "asc" },
        { lastName: "asc" },
        { firstName: "asc" },
      ],
      take: pagination.limit,
      skip: pagination.offset,
    });
  },

  async create({ barberShopId, data }) {
    const serviceCommissions = await validateServiceCommissions({
      client: prisma,
      barberShopId,
      roles: data.roles,
      serviceCommissions: data.serviceCommissions,
    });

    return prisma.staffMember.create({
      data: {
        barberShopId,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        email: data.email,
        normalizedEmail: data.normalizedEmail,
        phone: data.phone,
        normalizedPhone: data.normalizedPhone,
        photoDataUrl: data.photoDataUrl,
        isActive: data.isActive,
        commissionMode: data.commissionMode,
        commissionValue: data.commissionValue,
        workingDays: data.workingDays,
        restDays: data.restDays,
        specialties: data.specialties,
        roles: {
          create: data.roles.map((role) => ({ barberShopId, role })),
        },
        serviceCommissions: {
          create: serviceCommissions.map((commission) => ({
            barberShopId,
            serviceId: commission.serviceId,
            commissionMode: commission.commissionMode,
            commissionValue: commission.commissionValue,
          })),
        },
      },
      include: staffInclude,
    });
  },

  async findActiveById({ barberShopId, id }) {
    return prisma.staffMember.findFirst({
      where: { id, barberShopId, deletedAt: null, isActive: true },
      include: staffInclude,
    });
  },

  async update({ barberShopId, id, data }) {
    const existing = await prisma.staffMember.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true, roles: { select: { role: true } } },
    });

    if (!existing) {
      return null;
    }

    return prisma.$transaction(async (transaction) => {
      const finalRoles = data.roles ?? existing.roles.map(({ role }) => role);
      const serviceCommissions =
        data.serviceCommissions === undefined
          ? undefined
          : await validateServiceCommissions({
              client: transaction,
              barberShopId,
              roles: finalRoles,
              serviceCommissions: data.serviceCommissions,
            });

      await transaction.staffMember.update({
        where: { id },
        data: toStaffUpdateData(data),
      });

      if (data.roles !== undefined) {
        await transaction.staffMemberRole.deleteMany({
          where: { staffMemberId: id, barberShopId },
        });

        if (data.roles.length > 0) {
          await transaction.staffMemberRole.createMany({
            data: data.roles.map((role) => ({
              staffMemberId: id,
              barberShopId,
              role,
            })),
          });
        }
      }

      if (serviceCommissions !== undefined) {
        await transaction.staffServiceCommission.deleteMany({
          where: { staffMemberId: id, barberShopId },
        });

        if (serviceCommissions.length > 0) {
          await transaction.staffServiceCommission.createMany({
            data: serviceCommissions.map((commission) => ({
              staffMemberId: id,
              barberShopId,
              serviceId: commission.serviceId,
              commissionMode: commission.commissionMode,
              commissionValue: commission.commissionValue,
            })),
          });
        }
      } else if (data.roles !== undefined) {
        await deleteIneligibleServiceCommissions({
          client: transaction,
          barberShopId,
          staffMemberId: id,
          roles: finalRoles,
        });
      }

      return transaction.staffMember.findFirstOrThrow({
        where: { id, barberShopId },
        include: staffInclude,
      });
    });
  },

  async softDelete({ barberShopId, id, deletedAt }) {
    const existing = await prisma.staffMember.findFirst({
      where: { id, barberShopId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.staffMember.update({
      where: { id },
      data: { deletedAt, isActive: false },
      include: staffInclude,
    });
  },
};

type ServiceCommissionValidationClient = {
  service: {
    findMany(input: {
      where: {
        barberShopId: string;
        deletedAt: null;
        isActive: true;
        allowedRoles: {
          some: { barberShopId: string; role: { in: StaffRole[] } };
        };
      };
      select: { id: true };
    }): Promise<Array<{ id: string }>>;
  };
};

type ServiceCommissionPruneClient = {
  staffServiceCommission: {
    deleteMany(input: {
      where: {
        staffMemberId: string;
        barberShopId: string;
        NOT?: {
          service: {
            barberShopId: string;
            deletedAt: null;
            isActive: true;
            allowedRoles: {
              some: { barberShopId: string; role: { in: StaffRole[] } };
            };
          };
        };
      };
    }): Promise<unknown>;
  };
};

async function validateServiceCommissions({
  client,
  barberShopId,
  roles,
  serviceCommissions,
}: {
  client: ServiceCommissionValidationClient;
  barberShopId: string;
  roles: StaffRole[];
  serviceCommissions: NormalizedStaffServiceCommissionInput[];
}) {
  if (serviceCommissions.length === 0) return [];

  const eligibleServices = await client.service.findMany({
    where: {
      barberShopId,
      deletedAt: null,
      isActive: true,
      allowedRoles: {
        some: { barberShopId, role: { in: roles } },
      },
    },
    select: { id: true },
  });
  const eligibleServiceIds = new Set(eligibleServices.map(({ id }) => id));

  const invalidCommission = serviceCommissions.find(
    (commission) => !eligibleServiceIds.has(commission.serviceId),
  );

  if (invalidCommission) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message:
        "Service commissions must reference active services allowed for the selected staff roles.",
    });
  }

  return serviceCommissions;
}

async function deleteIneligibleServiceCommissions({
  client,
  barberShopId,
  staffMemberId,
  roles,
}: {
  client: ServiceCommissionPruneClient;
  barberShopId: string;
  staffMemberId: string;
  roles: StaffRole[];
}) {
  await client.staffServiceCommission.deleteMany({
    where: {
      staffMemberId,
      barberShopId,
      ...(roles.length === 0
        ? {}
        : {
            NOT: {
              service: {
                barberShopId,
                deletedAt: null,
                isActive: true,
                allowedRoles: {
                  some: { barberShopId, role: { in: roles } },
                },
              },
            },
          }),
    },
  });
}

function toStaffUpdateData(data: NormalizedStaffUpdateInput) {
  return {
    ...(data.userId === undefined ? {} : { userId: data.userId }),
    ...(data.firstName === undefined ? {} : { firstName: data.firstName }),
    ...(data.lastName === undefined ? {} : { lastName: data.lastName }),
    ...(data.displayName === undefined
      ? {}
      : { displayName: data.displayName }),
    ...(data.email === undefined ? {} : { email: data.email }),
    ...(data.normalizedEmail === undefined
      ? {}
      : { normalizedEmail: data.normalizedEmail }),
    ...(data.phone === undefined ? {} : { phone: data.phone }),
    ...(data.normalizedPhone === undefined
      ? {}
      : { normalizedPhone: data.normalizedPhone }),
    ...(data.photoDataUrl === undefined
      ? {}
      : { photoDataUrl: data.photoDataUrl }),
    ...(data.isActive === undefined ? {} : { isActive: data.isActive }),
    ...(data.commissionMode === undefined
      ? {}
      : { commissionMode: data.commissionMode }),
    ...(data.commissionValue === undefined
      ? {}
      : { commissionValue: data.commissionValue }),
    ...(data.workingDays === undefined
      ? {}
      : { workingDays: data.workingDays }),
    ...(data.restDays === undefined ? {} : { restDays: data.restDays }),
    ...(data.specialties === undefined
      ? {}
      : { specialties: data.specialties }),
  };
}
