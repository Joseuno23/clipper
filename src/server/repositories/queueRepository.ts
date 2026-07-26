import { AppointmentSource, QueueStatus } from "../../generated/prisma/enums";
import { ApiError } from "../api/errors";
import { prisma } from "../db/client";
import { appointmentStatusForQueueStatus } from "../domain/queue/service";
import type { QueueRepository } from "../domain/queue/types";

const activeQueueStatuses: QueueStatus[] = [
  QueueStatus.IN_SERVICE,
  QueueStatus.CALLED,
  QueueStatus.WAITING,
];

const movableQueueStatuses: QueueStatus[] = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
];

const ticketInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  services: { orderBy: { sortOrder: "asc" as const } },
};

export const queueRepository: QueueRepository = {
  async listLiveQueues({ barberShopId }) {
    const [staffMembers, tickets] = await Promise.all([
      prisma.staffMember.findMany({
        where: { barberShopId, deletedAt: null, isActive: true },
        select: {
          id: true,
          displayName: true,
          firstName: true,
          lastName: true,
          roles: { orderBy: { role: "asc" }, select: { role: true } },
          specialties: true,
        },
        orderBy: [
          { displayName: "asc" },
          { lastName: "asc" },
          { firstName: "asc" },
        ],
      }),
      prisma.appointment.findMany({
        where: {
          barberShopId,
          source: AppointmentSource.WALK_IN,
          deletedAt: null,
          staffMemberId: { not: null },
          queueStatus: { in: activeQueueStatuses },
        },
        include: ticketInclude,
        orderBy: [{ queuePosition: "asc" }, { queuedAt: "asc" }],
      }),
    ]);

    const ticketsByStaff = new Map<string, typeof tickets>();
    for (const ticket of tickets) {
      if (!ticket.staffMemberId) continue;
      const group = ticketsByStaff.get(ticket.staffMemberId) ?? [];
      group.push(ticket);
      ticketsByStaff.set(ticket.staffMemberId, group);
    }

    return staffMembers.map((staff) => ({
      ...staff,
      tickets: ticketsByStaff.get(staff.id) ?? [],
    }));
  },

  async findActiveClient({ barberShopId, clientId }) {
    return prisma.client.findFirst({
      where: {
        id: clientId,
        barberShopId,
        deletedAt: null,
        isBlocked: false,
      },
      select: { id: true },
    });
  },

  async findActiveStaff({ barberShopId, staffMemberId }) {
    return prisma.staffMember.findFirst({
      where: {
        id: staffMemberId,
        barberShopId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true },
    });
  },

  async findActiveService({ barberShopId, serviceId }) {
    return prisma.service.findFirst({
      where: { id: serviceId, barberShopId, deletedAt: null, isActive: true },
      select: { id: true, name: true, durationMinutes: true, price: true },
    });
  },

  async createWalkIn({ barberShopId, data, service, queuedAt }) {
    return prisma.$transaction(async (transaction) => {
      await lockStaffQueue(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
      });

      const nextPosition = await nextQueuePosition(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
      });
      const endAt = new Date(
        queuedAt.getTime() + service.durationMinutes * 60 * 1000,
      );

      return transaction.appointment.create({
        data: {
          barberShopId,
          clientId: data.clientId,
          staffMemberId: data.staffMemberId,
          source: AppointmentSource.WALK_IN,
          status: appointmentStatusForQueueStatus(QueueStatus.WAITING),
          queueStatus: QueueStatus.WAITING,
          queuedAt,
          checkedInAt: queuedAt,
          queuePosition: nextPosition,
          startAt: queuedAt,
          endAt,
          services: {
            create: {
              barberShopId,
              serviceId: service.id,
              serviceNameSnapshot: service.name,
              servicePriceSnapshot: service.price.toString(),
              serviceDurationSnapshot: service.durationMinutes,
              sortOrder: 0,
            },
          },
        },
        include: ticketInclude,
      });
    });
  },

  async updateTicket({ barberShopId, ticketId, data }) {
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.appointment.findFirst({
        where: {
          id: ticketId,
          barberShopId,
          source: AppointmentSource.WALK_IN,
          deletedAt: null,
        },
        select: { id: true, staffMemberId: true, queueStatus: true },
      });

      if (!existing) return null;

      assertEditableTicket(existing.queueStatus);

      const movedStaff =
        data.staffMemberId !== undefined &&
        data.staffMemberId !== existing.staffMemberId;
      const queueStatus = data.queueStatus ?? existing.queueStatus;

      const staffMemberId = data.staffMemberId ?? existing.staffMemberId;

      if (!staffMemberId) {
        throw invalidQueueUpdate("Queue ticket must have a staff member.");
      }

      if (movedStaff) {
        assertMovableTicket(existing.queueStatus);
        await lockStaffQueue(transaction, { barberShopId, staffMemberId });
      } else {
        await lockStaffQueue(transaction, { barberShopId, staffMemberId });
      }

      assertQueueTransition(existing.queueStatus, queueStatus);

      if (queueStatus === QueueStatus.IN_SERVICE) {
        await assertNoOtherInServiceTicket(transaction, {
          barberShopId,
          staffMemberId,
          ticketId,
        });
      }

      const queuePosition = movedStaff
        ? await nextQueuePosition(transaction, {
            barberShopId,
            staffMemberId,
          })
        : undefined;

      return transaction.appointment.update({
        where: { id: ticketId },
        data: {
          ...(data.staffMemberId === undefined
            ? {}
            : { staffMemberId: data.staffMemberId }),
          ...(data.queueStatus === undefined
            ? {}
            : { queueStatus: data.queueStatus }),
          ...(data.queueStatus === undefined
            ? {}
            : { status: appointmentStatusForQueueStatus(data.queueStatus) }),
          ...(queuePosition === undefined ? {} : { queuePosition }),
          ...(queueStatus === QueueStatus.IN_SERVICE
            ? { status: appointmentStatusForQueueStatus(queueStatus) }
            : {}),
        },
        include: ticketInclude,
      });
    });
  },
};

type QueuePositionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  appointment: {
    aggregate(input: {
      where: {
        barberShopId: string;
        staffMemberId: string;
        source: typeof AppointmentSource.WALK_IN;
        deletedAt: null;
        queueStatus: { in: typeof activeQueueStatuses };
      };
      _max: { queuePosition: true };
    }): Promise<{ _max: { queuePosition: number | null } }>;
    count(input: {
      where: {
        id: { not: string };
        barberShopId: string;
        staffMemberId: string;
        source: typeof AppointmentSource.WALK_IN;
        deletedAt: null;
        queueStatus: typeof QueueStatus.IN_SERVICE;
      };
    }): Promise<number>;
  };
};

async function lockStaffQueue(
  client: Pick<QueuePositionClient, "$executeRawUnsafe">,
  input: { barberShopId: string; staffMemberId: string },
) {
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    `${input.barberShopId}:${input.staffMemberId}:walk-in-queue`,
  );
}

async function nextQueuePosition(
  client: QueuePositionClient,
  input: { barberShopId: string; staffMemberId: string },
) {
  const result = await client.appointment.aggregate({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: { in: activeQueueStatuses },
    },
    _max: { queuePosition: true },
  });

  return (result._max.queuePosition ?? 0) + 1;
}

async function assertNoOtherInServiceTicket(
  client: Pick<QueuePositionClient, "appointment">,
  input: { barberShopId: string; staffMemberId: string; ticketId: string },
) {
  const count = await client.appointment.count({
    where: {
      id: { not: input.ticketId },
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: QueueStatus.IN_SERVICE,
    },
  });

  if (count > 0) {
    throw new ApiError({
      code: "CONFLICT",
      message: "Staff member already has a queue ticket in service.",
    });
  }
}

function assertEditableTicket(queueStatus: QueueStatus) {
  if (activeQueueStatuses.includes(queueStatus)) return;

  throw invalidQueueUpdate("Only active queue tickets can be updated.");
}

function assertMovableTicket(queueStatus: QueueStatus) {
  if (movableQueueStatuses.includes(queueStatus)) return;

  throw invalidQueueUpdate("Only waiting queue tickets can be moved.");
}

function assertQueueTransition(from: QueueStatus, to: QueueStatus) {
  const allowed = allowedTransitions[from] ?? [];

  if (allowed.includes(to)) return;

  throw invalidQueueUpdate(`Cannot move queue ticket from ${from} to ${to}.`);
}

const allowedTransitions: Partial<Record<QueueStatus, QueueStatus[]>> = {
  [QueueStatus.WAITING]: [
    QueueStatus.WAITING,
    QueueStatus.CALLED,
    QueueStatus.IN_SERVICE,
    QueueStatus.LEFT,
  ],
  [QueueStatus.CALLED]: [
    QueueStatus.CALLED,
    QueueStatus.WAITING,
    QueueStatus.IN_SERVICE,
    QueueStatus.LEFT,
  ],
  [QueueStatus.IN_SERVICE]: [
    QueueStatus.IN_SERVICE,
    QueueStatus.SERVED,
    QueueStatus.LEFT,
  ],
};

function invalidQueueUpdate(message: string): ApiError {
  return new ApiError({ code: "BAD_REQUEST", message });
}
