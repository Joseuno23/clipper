import {
  AppointmentSource,
  AppointmentStatus,
  QueueStatus,
  SaleStatus,
} from "../../generated/prisma/enums";
import { BUSINESS_TIME_ZONE } from "../../shared/lib/businessLocale";
import { ApiError } from "../api/errors";
import { prisma } from "../db/client";
import { appointmentStatusForQueueStatus } from "../domain/queue/service";
import type {
  QueuePositionAction,
  QueueRepository,
} from "../domain/queue/types";
import {
  activeQueueStatuses,
  cancelQueueTicket,
  lockStaffQueue,
  lockStaffQueues,
  promoteFirstWaitingTicket,
  renumberWaitingTickets,
} from "./queueLifecycle";
import {
  createLinkedDraftSale,
  saleBusinessDateFromInstant,
  syncDraftSaleServices,
} from "./saleRepository";

const movableQueueStatuses: QueueStatus[] = [
  QueueStatus.IN_SERVICE,
  QueueStatus.WAITING,
  QueueStatus.CALLED,
];

const ticketInclude = {
  client: { select: { id: true, firstName: true, lastName: true } },
  services: { orderBy: { sortOrder: "asc" as const } },
};

const appointmentListItemInclude = {
  ...ticketInclude,
  staffMember: {
    select: { displayName: true, firstName: true, lastName: true },
  },
};

export const queueRepository: QueueRepository = {
  async listLiveQueues({ barberShopId }) {
    const now = new Date();

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
          deletedAt: null,
          staffMemberId: { not: null },
          queueStatus: { in: activeQueueStatuses },
          OR: [
            { source: AppointmentSource.WALK_IN },
            {
              source: { not: AppointmentSource.WALK_IN },
              startAt: { lte: now },
            },
          ],
        },
        include: ticketInclude,
        orderBy: [
          { queuePosition: "asc" },
          { startAt: "asc" },
          { queuedAt: "asc" },
        ],
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

  async listAppointmentsByDate({ barberShopId, from, toExclusive }) {
    return prisma.appointment.findMany({
      where: {
        barberShopId,
        deletedAt: null,
        startAt: { gte: from, lt: toExclusive },
      },
      include: appointmentListItemInclude,
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    });
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

  async createWalkIn({
    barberShopId,
    timeZone = BUSINESS_TIME_ZONE,
    data,
    services,
    queuedAt,
  }) {
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

      const appointment = await transaction.appointment.create({
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

      await createLinkedDraftSale(transaction, {
        barberShopId,
        appointmentId: appointment.id,
        clientId,
        staffMemberId: data.staffMemberId,
        businessDate: saleBusinessDateFromInstant(timeZone, queuedAt),
        services,
      });

      return appointment;
    });
  },

  async createScheduledAppointment({
    barberShopId,
    timeZone = BUSINESS_TIME_ZONE,
    data,
    services,
    now,
  }) {
    return prisma.$transaction(async (transaction) => {
      await lockStaffQueue(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
      });

      const clientId = await resolveWalkInClientId(transaction, {
        barberShopId,
        client: data.client,
      });
      const totalDurationMinutes = services.reduce(
        (total, service) => total + service.durationMinutes,
        0,
      );
      const endAt = new Date(
        data.startAt.getTime() + totalDurationMinutes * 60 * 1000,
      );

      await assertStaffAvailableForAppointment(transaction, {
        barberShopId,
        staffMemberId: data.staffMemberId,
        requestedStartAt: data.startAt,
        requestedEndAt: endAt,
        now,
      });

      const appointment = await transaction.appointment.create({
        data: {
          barberShopId,
          clientId,
          staffMemberId: data.staffMemberId,
          source: AppointmentSource.PHONE,
          status: AppointmentStatus.SCHEDULED,
          queueStatus: QueueStatus.NOT_QUEUED,
          queuedAt: null,
          checkedInAt: null,
          queuePosition: null,
          startAt: data.startAt,
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

      await createLinkedDraftSale(transaction, {
        barberShopId,
        appointmentId: appointment.id,
        clientId,
        staffMemberId: data.staffMemberId,
        businessDate: saleBusinessDateFromInstant(timeZone, data.startAt),
        services,
      });

      return appointment;
    });
  },

  async updateTicket({ barberShopId, ticketId, data, services }) {
    return prisma.$transaction(async (transaction) => {
      const existing = await transaction.appointment.findFirst({
        where: {
          id: ticketId,
          barberShopId,
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
        await syncDraftSaleServices(transaction, {
          barberShopId,
          appointmentId: ticketId,
          services,
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

  async cancelTicket({ barberShopId, ticketId, reason }) {
    return prisma.$transaction(async (transaction) => {
      const ticket = await transaction.appointment.findFirst({
        where: {
          id: ticketId,
          barberShopId,
          deletedAt: null,
          queueStatus: { in: activeQueueStatuses },
        },
        select: { id: true },
      });
      if (!ticket) return null;

      const linkedSale = await transaction.sale.findFirst({
        where: { barberShopId, appointmentId: ticketId, deletedAt: null },
        select: { id: true, status: true },
      });

      if (linkedSale) {
        if (linkedSale.status === SaleStatus.COMPLETED) {
          throw new ApiError({
            code: "BAD_REQUEST",
            message: "Completed sales cannot be cancelled.",
          });
        }
        if (linkedSale.status !== SaleStatus.DRAFT) {
          throw new ApiError({
            code: "BAD_REQUEST",
            message: "Only draft sales can be cancelled.",
          });
        }
        await transaction.sale.update({
          where: { id: linkedSale.id },
          data: { status: SaleStatus.CANCELLED, cancellationReason: reason },
        });
      }

      await cancelQueueTicket(transaction, {
        barberShopId,
        appointmentId: ticketId,
        reason,
      });

      return transaction.appointment.findFirst({
        where: { id: ticketId, barberShopId, deletedAt: null },
        include: ticketInclude,
      });
    });
  },
};

type QueuePositionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  appointment: {
    aggregate(input: {
      where: Record<string, unknown>;
      _max: { queuePosition: true };
    }): Promise<{ _max: { queuePosition: number | null } }>;
    count(input: { where: Record<string, unknown> }): Promise<number>;
    findMany(input: {
      where: Record<string, unknown>;
      select?: Record<string, unknown>;
      include?: typeof ticketInclude;
      orderBy?: Array<Record<string, "asc" | "desc">>;
    }): Promise<WaitingTicketPosition[]>;
    findFirst(input: {
      where: Record<string, unknown>;
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

async function nextQueuePosition(
  client: QueuePositionClient,
  input: { barberShopId: string; staffMemberId: string },
) {
  const result = await client.appointment.aggregate({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      deletedAt: null,
      queueStatus: { in: activeQueueStatuses },
    },
    _max: { queuePosition: true },
  });

  return (result._max.queuePosition ?? 0) + 1;
}

async function assertStaffAvailableForAppointment(
  client: QueuePositionClient,
  input: {
    barberShopId: string;
    staffMemberId: string;
    requestedStartAt: Date;
    requestedEndAt: Date;
    now: Date;
  },
) {
  const dayStart = startOfUtcDay(input.requestedStartAt);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  const records = (await client.appointment.findMany({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      deletedAt: null,
      OR: [
        { queueStatus: { in: activeQueueStatuses } },
        {
          status: {
            in: [AppointmentStatus.SCHEDULED, AppointmentStatus.CONFIRMED],
          },
          startAt: { gte: dayStart, lt: dayEnd },
        },
      ],
    },
    include: ticketInclude,
    orderBy: [
      { queuePosition: "asc" },
      { startAt: "asc" },
      { queuedAt: "asc" },
    ],
  })) as unknown as AvailabilityAppointment[];

  const intervals = buildAvailabilityIntervals(records, input.now);
  const conflict = intervals.find((interval) =>
    intervalsOverlap(
      input.requestedStartAt,
      input.requestedEndAt,
      interval.startAt,
      interval.endAt,
    ),
  );

  if (!conflict) return;

  throw new ApiError({
    code: "CONFLICT",
    message: `Staff member is unavailable at the requested time. Estimated free time is ${conflict.endAt.toISOString()}.`,
  });
}

type AvailabilityAppointment = {
  id: string;
  source: AppointmentSource;
  queueStatus: QueueStatus;
  startAt: Date;
  endAt: Date;
  services: Array<{ serviceDurationSnapshot: number }>;
};

function buildAvailabilityIntervals(
  records: AvailabilityAppointment[],
  now: Date,
) {
  const intervals: Array<{ startAt: Date; endAt: Date }> = [];
  const activeRecords = records.filter((record) =>
    isSequentialQueueWorkload(record),
  );
  const scheduledRecords = records.filter(
    (record) => !isSequentialQueueWorkload(record),
  );
  let cursor = now;

  for (const record of activeRecords) {
    const startAt = cursor;
    const endAt = new Date(
      startAt.getTime() + durationMinutes(record) * 60_000,
    );
    intervals.push({ startAt, endAt });
    cursor = endAt;
  }

  for (const record of scheduledRecords) {
    intervals.push({ startAt: record.startAt, endAt: record.endAt });
  }

  return intervals;
}

function isSequentialQueueWorkload(record: AvailabilityAppointment) {
  return (
    record.source === AppointmentSource.WALK_IN &&
    activeQueueStatuses.includes(record.queueStatus)
  );
}

function durationMinutes(record: AvailabilityAppointment) {
  const serviceDuration = record.services.reduce(
    (total, service) => total + service.serviceDurationSnapshot,
    0,
  );

  if (serviceDuration > 0) return serviceDuration;
  return Math.max(
    0,
    Math.round((record.endAt.getTime() - record.startAt.getTime()) / 60_000),
  );
}

function intervalsOverlap(
  leftStart: Date,
  leftEnd: Date,
  rightStart: Date,
  rightEnd: Date,
) {
  return leftStart < rightEnd && leftEnd > rightStart;
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
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

async function assertNoOtherInServiceTicket(
  client: Pick<QueuePositionClient, "appointment">,
  input: { barberShopId: string; staffMemberId: string; ticketId: string },
) {
  const count = await client.appointment.count({
    where: {
      id: { not: input.ticketId },
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
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
