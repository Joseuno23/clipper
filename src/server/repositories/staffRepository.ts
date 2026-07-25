import { prisma } from "../db/client";
import type {
  NormalizedStaffUpdateInput,
  StaffRepository,
} from "../domain/staff/types";

const staffInclude = {
  roles: { orderBy: { role: "asc" as const } },
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
        isActive: data.isActive,
        commissionMode: data.commissionMode,
        commissionValue: data.commissionValue,
        workingDays: data.workingDays,
        restDays: data.restDays,
        specialties: data.specialties,
        roles: {
          create: data.roles.map((role) => ({ barberShopId, role })),
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
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    return prisma.$transaction(async (transaction) => {
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
