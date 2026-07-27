import { AppointmentSource, QueueStatus } from "../../generated/prisma/enums";
import { ApiError } from "../api/errors";
import { prisma } from "../db/client";
import { appointmentStatusForQueueStatus } from "../domain/queue/service";
import type {
  QueuePositionAction,
  QueueRepository,
} from "../domain/queue/types";

const activeQueueStatuses: QueueStatus[] = [
  QueueStatus.IN_SERVICE,
  QueueStatus.CALLED,
  QueueStatus.WAITING,
];

const movableQueueStatuses: QueueStatus[] = [
  QueueStatus.IN_SERVICE,
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

  async findActiveServices({ barberShopId, serviceIds }) {
    return prisma.service.findMany({
      where: {
        id: { in: serviceIds },
        barberShopId,
        deletedAt: null,
        isActive: true,
      },
      select: { id: true, name: true, durationMinutes: true, price: true },
    });
  },

  async createWalkIn({ barberShopId, data, services, queuedAt }) {
    return prisma.$transaction(async (transaction) => {
      await lockStaffQueue(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
      });

      const clientId = await resolveWalkInClientId(transaction, {
        barberShopId,
        client: data.client,
      });

      await assertNoOtherActiveClientTicket(transaction, {
        barberShopId,
        clientId,
      });

      const nextPosition = await nextQueuePosition(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
      });
      const startsInService = nextPosition === 1;
      const queueStatus = startsInService
        ? QueueStatus.IN_SERVICE
        : QueueStatus.WAITING;
      const totalDurationMinutes = services.reduce(
        (total, service) => total + service.durationMinutes,
        0,
      );
      const endAt = new Date(
        queuedAt.getTime() + totalDurationMinutes * 60 * 1000,
      );

      return transaction.appointment.create({
        data: {
          barberShopId,
          clientId,
          staffMemberId: data.staffMemberId,
          source: AppointmentSource.WALK_IN,
          status: appointmentStatusForQueueStatus(queueStatus),
          queueStatus,
          queuedAt,
          checkedInAt: queuedAt,
          queuePosition: nextPosition,
          startAt: queuedAt,
          endAt,
          services: {
            create: services.map((service, sortOrder) => ({
              barberShopId,
              serviceId: service.id,
              serviceNameSnapshot: service.name,
              servicePriceSnapshot: service.price.toString(),
              serviceDurationSnapshot: service.durationMinutes,
              sortOrder,
            })),
          },
        },
        include: ticketInclude,
      });
    });
  },

  async updateTicket({ barberShopId, ticketId, data, services }) {
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.appointment.findFirst({
        where: {
          id: ticketId,
          barberShopId,
          source: AppointmentSource.WALK_IN,
          deletedAt: null,
        },
        select: {
          id: true,
          clientId: true,
          staffMemberId: true,
          queueStatus: true,
          queuePosition: true,
          startAt: true,
        },
      });

      if (!existing) return null;

      assertEditableTicket(existing.queueStatus);

      if (data.clientId !== undefined && data.clientId !== existing.clientId) {
        await assertNoOtherActiveClientTicket(transaction, {
          barberShopId,
          clientId: data.clientId,
          ticketId,
        });
      }

      const movedStaff =
        data.staffMemberId !== undefined &&
        data.staffMemberId !== existing.staffMemberId;
      const positionAction = data.positionAction;
      const staffMemberId = data.staffMemberId ?? existing.staffMemberId;

      if (!staffMemberId) {
        throw invalidQueueUpdate("Queue ticket must have a staff member.");
      }

      if (movedStaff) {
        assertMovableTicket(existing.queueStatus);
        await lockStaffQueues(transaction, {
          barberShopId,
          staffMemberIds: [existing.staffMemberId, staffMemberId],
        });
      } else {
        await lockStaffQueue(transaction, { barberShopId, staffMemberId });
      }

      if (positionAction !== undefined) {
        assertReorderableTicket(existing.queueStatus);
        assertReorderActionForUpdate({ movedStaff, positionAction });
      }

      if (positionAction === "CHAIR") {
        return promoteWaitingTicketToChair(transaction, {
          barberShopId,
          staffMemberId,
          ticketId,
          selectedQueuePosition: existing.queuePosition,
        });
      }

      const movedTicketPlacement = movedStaff
        ? await resolveMovedTicketPlacement(transaction, {
            barberShopId,
            staffMemberId,
          })
        : undefined;

      const effectiveDestinationStatus =
        movedTicketPlacement?.queueStatus ??
        data.queueStatus ??
        existing.queueStatus;

      if (!(
        movedStaff &&
        existing.queueStatus === QueueStatus.IN_SERVICE &&
        movedTicketPlacement?.queueStatus === QueueStatus.WAITING
      )) {
        assertQueueTransition(existing.queueStatus, effectiveDestinationStatus);
      }

      if (effectiveDestinationStatus === QueueStatus.IN_SERVICE) {
        await assertNoOtherInServiceTicket(transaction, {
          barberShopId,
          staffMemberId,
          ticketId,
        });
      }

      if (services) {
        await transaction.appointmentService.deleteMany({
          where: { appointmentId: ticketId, barberShopId },
        });
        await transaction.appointmentService.createMany({
          data: services.map((service, sortOrder) => ({
            appointmentId: ticketId,
            barberShopId,
            serviceId: service.id,
            serviceNameSnapshot: service.name,
            servicePriceSnapshot: service.price.toString(),
            serviceDurationSnapshot: service.durationMinutes,
            sortOrder,
          })),
        });
      }

      const serviceDurationMinutes = services?.reduce(
        (total, service) => total + service.durationMinutes,
        0,
      );
      const effectiveQueueStatus =
        movedTicketPlacement?.queueStatus ?? data.queueStatus;

      const updated = await transaction.appointment.update({
        where: { id: ticketId },
        data: {
          ...(data.staffMemberId === undefined
            ? {}
            : { staffMemberId: data.staffMemberId }),
          ...(effectiveQueueStatus === undefined
            ? {}
            : {
                queueStatus: effectiveQueueStatus,
              }),
          ...(effectiveQueueStatus === undefined
            ? {}
            : {
                status: appointmentStatusForQueueStatus(effectiveQueueStatus),
              }),
          ...(movedTicketPlacement === undefined
            ? {}
            : { queuePosition: movedTicketPlacement.queuePosition }),
          ...(data.clientId === undefined ? {} : { clientId: data.clientId }),
          ...(serviceDurationMinutes === undefined
            ? {}
            : {
                endAt: new Date(
                  existing.startAt.getTime() +
                    serviceDurationMinutes * 60 * 1000,
                ),
              }),
        },
        include: ticketInclude,
      });

      if (
        movedStaff &&
        existing.queueStatus === QueueStatus.IN_SERVICE &&
        existing.staffMemberId
      ) {
        await promoteFirstWaitingTicket(transaction, {
          barberShopId,
          staffMemberId: existing.staffMemberId,
        });
      }

      if (movedStaff && existing.staffMemberId) {
        await renumberWaitingTickets(transaction, {
          barberShopId,
          staffMemberId: existing.staffMemberId,
          movingTicketId: ticketId,
          action: "LAST",
          excludeMovingTicket: true,
        });
      }

      if (
        movedStaff &&
        movedTicketPlacement?.queueStatus === QueueStatus.WAITING
      ) {
        await renumberWaitingTickets(transaction, {
          barberShopId,
          staffMemberId,
          movingTicketId: ticketId,
          action: positionAction ?? "LAST",
        });
      } else if (!movedStaff && positionAction !== undefined) {
        await renumberWaitingTickets(transaction, {
          barberShopId,
          staffMemberId,
          movingTicketId: ticketId,
          action: positionAction,
        });
      }

      return updated;
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
        queueStatus: { in: QueueStatus[] };
      };
      _max: { queuePosition: true };
    }): Promise<{ _max: { queuePosition: number | null } }>;
    count(input: { where: Record<string, unknown> }): Promise<number>;
    findMany(input: {
      where: {
        barberShopId: string;
        staffMemberId: string;
        source: typeof AppointmentSource.WALK_IN;
        deletedAt: null;
        queueStatus: typeof QueueStatus.WAITING;
        id?: { not: string };
      };
      select: { id: true; queuePosition: true; queuedAt: true };
      orderBy: Array<{ queuePosition: "asc" } | { queuedAt: "asc" }>;
    }): Promise<WaitingTicketPosition[]>;
    findFirst(input: {
      where: {
        id?: { not: string };
        barberShopId: string;
        staffMemberId: string;
        source: typeof AppointmentSource.WALK_IN;
        deletedAt: null;
        queueStatus: typeof QueueStatus.IN_SERVICE;
      };
      select: { id: true; queuePosition: true };
    }): Promise<{ id: string; queuePosition: number | null } | null>;
    update(input: {
      where: { id: string };
      data: {
        queuePosition?: number | null;
        queueStatus?: QueueStatus;
        status?: ReturnType<typeof appointmentStatusForQueueStatus>;
      };
      include?: typeof ticketInclude;
    }): Promise<unknown>;
  };
};

type WaitingTicketPosition = {
  id: string;
  queuePosition: number | null;
  queuedAt: Date | null;
};

type QueueTransactionClient = QueuePositionClient & {
  client: {
    create(input: {
      data: {
        barberShopId: string;
        firstName: string;
        lastName: string;
        phone: string | null;
        normalizedPhone: string | null;
        documentNumber: string | null;
        normalizedDocument: string | null;
      };
      select: { id: true };
    }): Promise<{ id: string }>;
  };
};

async function resolveWalkInClientId(
  transaction: QueueTransactionClient,
  input: {
    barberShopId: string;
    client: Parameters<QueueRepository["createWalkIn"]>[0]["data"]["client"];
  },
) {
  if (input.client.kind === "existing") return input.client.clientId;

  const client = await transaction.client.create({
    data: {
      barberShopId: input.barberShopId,
      firstName: input.client.firstName,
      lastName: input.client.lastName,
      phone: input.client.phone,
      normalizedPhone: input.client.normalizedPhone,
      documentNumber: input.client.documentNumber,
      normalizedDocument: input.client.normalizedDocument,
    },
    select: { id: true },
  });

  return client.id;
}

async function lockStaffQueue(
  client: Pick<QueuePositionClient, "$executeRawUnsafe">,
  input: { barberShopId: string; staffMemberId: string },
) {
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    `${input.barberShopId}:${input.staffMemberId}:walk-in-queue`,
  );
}

async function lockStaffQueues(
  client: Pick<QueuePositionClient, "$executeRawUnsafe">,
  input: { barberShopId: string; staffMemberIds: Array<string | null> },
) {
  const staffMemberIds = [
    ...new Set(input.staffMemberIds.filter(Boolean)),
  ].sort();

  for (const staffMemberId of staffMemberIds) {
    await lockStaffQueue(client, {
      barberShopId: input.barberShopId,
      staffMemberId: staffMemberId!,
    });
  }
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

async function resolveMovedTicketPlacement(
  client: QueuePositionClient,
  input: { barberShopId: string; staffMemberId: string },
) {
  const nextPosition = await nextQueuePosition(client, input);

  if (nextPosition === 1) {
    return { queueStatus: QueueStatus.IN_SERVICE, queuePosition: 1 };
  }

  return { queueStatus: QueueStatus.WAITING, queuePosition: nextPosition };
}

async function renumberWaitingTickets(
  client: QueuePositionClient,
  input: {
    barberShopId: string;
    staffMemberId: string;
    movingTicketId: string;
    action: QueuePositionAction;
    excludeMovingTicket?: boolean;
  },
) {
  const tickets = await client.appointment.findMany({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: QueueStatus.WAITING,
      ...(input.excludeMovingTicket
        ? { id: { not: input.movingTicketId } }
        : {}),
    },
    select: { id: true, queuePosition: true, queuedAt: true },
    orderBy: [{ queuePosition: "asc" }, { queuedAt: "asc" }],
  });
  const currentIndex = tickets.findIndex(
    (ticket) => ticket.id === input.movingTicketId,
  );
  const orderedTickets = [...tickets];

  if (!input.excludeMovingTicket && currentIndex === -1) {
    throw invalidQueueUpdate("Only waiting queue tickets can be reordered.");
  }

  if (!input.excludeMovingTicket) {
    const [movingTicket] = orderedTickets.splice(currentIndex, 1);
    const targetIndex = targetWaitingIndex({
      action: input.action,
      currentIndex,
      lastIndex: orderedTickets.length,
    });

    orderedTickets.splice(targetIndex, 0, movingTicket);
  }

  const firstPosition = await firstWaitingQueuePosition(client, {
    barberShopId: input.barberShopId,
    staffMemberId: input.staffMemberId,
  });

  await Promise.all(
    orderedTickets.map((ticket) =>
      client.appointment.update({
        where: { id: ticket.id },
        data: { queuePosition: null },
      }),
    ),
  );

  for (const [index, ticket] of orderedTickets.entries()) {
    await client.appointment.update({
      where: { id: ticket.id },
      data: { queuePosition: firstPosition + index },
    });
  }
}

async function promoteWaitingTicketToChair(
  client: QueuePositionClient,
  input: {
    barberShopId: string;
    staffMemberId: string;
    ticketId: string;
    selectedQueuePosition: number | null;
  },
) {
  const currentChair = await client.appointment.findFirst({
    where: {
      id: { not: input.ticketId },
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: QueueStatus.IN_SERVICE,
    },
    select: { id: true, queuePosition: true },
  });

  await client.appointment.update({
    where: { id: input.ticketId },
    data: { queuePosition: null },
  });

  if (currentChair) {
    await client.appointment.update({
      where: { id: currentChair.id },
      data: {
        queueStatus: QueueStatus.WAITING,
        status: appointmentStatusForQueueStatus(QueueStatus.WAITING),
        queuePosition: null,
      },
    });
  }

  const promoted = (await client.appointment.update({
    where: { id: input.ticketId },
    data: {
      queueStatus: QueueStatus.IN_SERVICE,
      status: appointmentStatusForQueueStatus(QueueStatus.IN_SERVICE),
      queuePosition: 1,
    },
    include: ticketInclude,
  })) as NonNullable<Awaited<ReturnType<QueueRepository["updateTicket"]>>>;

  if (currentChair) {
    await client.appointment.update({
      where: { id: currentChair.id },
      data: { queuePosition: input.selectedQueuePosition ?? 2 },
    });
    return promoted;
  }

  await renumberWaitingTickets(client, {
    barberShopId: input.barberShopId,
    staffMemberId: input.staffMemberId,
    movingTicketId: input.ticketId,
    action: "LAST",
    excludeMovingTicket: true,
  });

  return promoted;
}

async function promoteFirstWaitingTicket(
  client: QueuePositionClient,
  input: { barberShopId: string; staffMemberId: string },
) {
  const [nextTicket] = await client.appointment.findMany({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: QueueStatus.WAITING,
    },
    select: { id: true, queuePosition: true, queuedAt: true },
    orderBy: [{ queuePosition: "asc" }, { queuedAt: "asc" }],
  });

  if (!nextTicket) return;

  await client.appointment.update({
    where: { id: nextTicket.id },
    data: {
      queueStatus: QueueStatus.IN_SERVICE,
      status: appointmentStatusForQueueStatus(QueueStatus.IN_SERVICE),
      queuePosition: 1,
    },
  });
}

async function firstWaitingQueuePosition(
  client: Pick<QueuePositionClient, "appointment">,
  input: { barberShopId: string; staffMemberId: string },
) {
  const result = await client.appointment.aggregate({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: { in: [QueueStatus.IN_SERVICE, QueueStatus.CALLED] },
    },
    _max: { queuePosition: true },
  });

  return (result._max.queuePosition ?? 0) + 1;
}

function targetWaitingIndex(input: {
  action: QueuePositionAction;
  currentIndex: number;
  lastIndex: number;
}) {
  if (input.action === "UP") return Math.max(0, input.currentIndex - 1);
  if (input.action === "DOWN") {
    return Math.min(input.lastIndex, input.currentIndex + 1);
  }
  if (input.action === "FIRST_WAITING") return 0;
  return input.lastIndex;
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

async function assertNoOtherActiveClientTicket(
  client: Pick<QueuePositionClient, "appointment">,
  input: { barberShopId: string; clientId: string; ticketId?: string },
) {
  const count = await client.appointment.count({
    where: {
      ...(input.ticketId ? { id: { not: input.ticketId } } : {}),
      barberShopId: input.barberShopId,
      clientId: input.clientId,
      source: AppointmentSource.WALK_IN,
      deletedAt: null,
      queueStatus: { in: activeQueueStatuses },
    },
  });

  if (count > 0) {
    throw new ApiError({
      code: "CONFLICT",
      message: "Client already has an active walk-in queue ticket.",
    });
  }
}

function assertEditableTicket(queueStatus: QueueStatus) {
  if (activeQueueStatuses.includes(queueStatus)) return;

  throw invalidQueueUpdate("Only active queue tickets can be updated.");
}

function assertMovableTicket(queueStatus: QueueStatus) {
  if (movableQueueStatuses.includes(queueStatus)) return;

  throw invalidQueueUpdate("Only active queue tickets can be moved.");
}

function assertReorderableTicket(queueStatus: QueueStatus) {
  if (queueStatus === QueueStatus.WAITING) return;

  throw invalidQueueUpdate("Only waiting queue tickets can be reordered.");
}

function assertReorderActionForUpdate(input: {
  movedStaff: boolean;
  positionAction: QueuePositionAction;
}) {
  if (!input.movedStaff) return;
  if (["FIRST_WAITING", "LAST"].includes(input.positionAction)) return;

  throw invalidQueueUpdate(
    "Moved tickets can only target the first waiting position or queue end.",
  );
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
