import { QueueStatus } from "../../generated/prisma/enums";
import { ApiError } from "../api/errors";
import { appointmentStatusForQueueStatus } from "../domain/queue/service";
import type { QueuePositionAction } from "../domain/queue/types";

export const activeQueueStatuses: QueueStatus[] = [
  QueueStatus.IN_SERVICE,
  QueueStatus.CALLED,
  QueueStatus.WAITING,
];

type QueueLifecycleClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<unknown>;
  appointment: {
    aggregate(input: {
      where: {
        barberShopId: string;
        staffMemberId: string;
        deletedAt: null;
        queueStatus: { in: QueueStatus[] };
      };
      _max: { queuePosition: true };
    }): Promise<{ _max: { queuePosition: number | null } }>;
    findFirst(input: {
      where: Record<string, unknown>;
      select: Record<string, boolean>;
    }): Promise<Record<string, unknown> | null>;
    findMany(input: {
      where: {
        barberShopId: string;
        staffMemberId: string;
        deletedAt: null;
        queueStatus: typeof QueueStatus.WAITING;
        id?: { not: string };
      };
      select: { id: true; queuePosition: true; queuedAt: true };
      orderBy: Array<{ queuePosition: "asc" } | { queuedAt: "asc" }>;
    }): Promise<WaitingTicketPosition[]>;
    update(input: {
      where: { id: string };
      data: {
        queuePosition?: number | null;
        queueStatus?: QueueStatus;
        status?: ReturnType<typeof appointmentStatusForQueueStatus>;
        checkedInAt?: Date | null;
        cancellationReason?: string;
      };
    }): Promise<unknown>;
  };
};

type WaitingTicketPosition = {
  id: string;
  queuePosition: number | null;
  queuedAt: Date | null;
};

export async function completePaidSaleQueueTicket(
  client: QueueLifecycleClient,
  input: { barberShopId: string; appointmentId: string },
) {
  const ticket = (await client.appointment.findFirst({
    where: {
      id: input.appointmentId,
      barberShopId: input.barberShopId,
      deletedAt: null,
      queueStatus: { in: activeQueueStatuses },
    },
    select: {
      id: true,
      staffMemberId: true,
      queueStatus: true,
      queuePosition: true,
    },
  })) as {
    id: string;
    staffMemberId: string | null;
    queueStatus: QueueStatus;
    queuePosition: number | null;
  } | null;

  if (!ticket) return;

  if (ticket.staffMemberId) {
    await lockStaffQueue(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
    });
  }

  await client.appointment.update({
    where: { id: ticket.id },
    data: {
      queueStatus: QueueStatus.SERVED,
      status: appointmentStatusForQueueStatus(QueueStatus.SERVED),
      queuePosition: null,
    },
  });

  if (!ticket.staffMemberId) return;

  if (ticket.queueStatus === QueueStatus.IN_SERVICE) {
    const promotedTicketId = await promoteFirstWaitingTicket(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
    });

    if (!promotedTicketId) return;

    await renumberWaitingTickets(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
      movingTicketId: promotedTicketId,
      action: "LAST",
      excludeMovingTicket: true,
    });
    return;
  }

  await renumberWaitingTickets(client, {
    barberShopId: input.barberShopId,
    staffMemberId: ticket.staffMemberId,
    movingTicketId: ticket.id,
    action: "LAST",
    excludeMovingTicket: true,
  });
}

export async function cancelQueueTicket(
  client: QueueLifecycleClient,
  input: { barberShopId: string; appointmentId: string; reason: string },
) {
  const ticket = (await client.appointment.findFirst({
    where: {
      id: input.appointmentId,
      barberShopId: input.barberShopId,
      deletedAt: null,
      queueStatus: { in: activeQueueStatuses },
    },
    select: {
      id: true,
      staffMemberId: true,
      queueStatus: true,
      queuePosition: true,
    },
  })) as {
    id: string;
    staffMemberId: string | null;
    queueStatus: QueueStatus;
    queuePosition: number | null;
  } | null;

  if (!ticket) return;

  if (ticket.staffMemberId) {
    await lockStaffQueue(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
    });
  }

  await client.appointment.update({
    where: { id: ticket.id },
    data: {
      queueStatus: QueueStatus.LEFT,
      status: appointmentStatusForQueueStatus(QueueStatus.LEFT),
      queuePosition: null,
      cancellationReason: input.reason,
    },
  });

  if (!ticket.staffMemberId) return;

  if (ticket.queueStatus === QueueStatus.IN_SERVICE) {
    const promotedTicketId = await promoteFirstWaitingTicket(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
    });

    if (!promotedTicketId) return;

    await renumberWaitingTickets(client, {
      barberShopId: input.barberShopId,
      staffMemberId: ticket.staffMemberId,
      movingTicketId: promotedTicketId,
      action: "LAST",
      excludeMovingTicket: true,
    });
    return;
  }

  await renumberWaitingTickets(client, {
    barberShopId: input.barberShopId,
    staffMemberId: ticket.staffMemberId,
    movingTicketId: ticket.id,
    action: "LAST",
    excludeMovingTicket: true,
  });
}

export async function lockStaffQueue(
  client: Pick<QueueLifecycleClient, "$executeRawUnsafe">,
  input: { barberShopId: string; staffMemberId: string },
) {
  await client.$executeRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
    `${input.barberShopId}:${input.staffMemberId}:walk-in-queue`,
  );
}

export async function lockStaffQueues(
  client: Pick<QueueLifecycleClient, "$executeRawUnsafe">,
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

export async function renumberWaitingTickets(
  client: Pick<QueueLifecycleClient, "appointment">,
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
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Only waiting queue tickets can be reordered.",
    });
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

export async function promoteFirstWaitingTicket(
  client: Pick<QueueLifecycleClient, "appointment">,
  input: { barberShopId: string; staffMemberId: string },
) {
  const [nextTicket] = await client.appointment.findMany({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
      deletedAt: null,
      queueStatus: QueueStatus.WAITING,
    },
    select: { id: true, queuePosition: true, queuedAt: true },
    orderBy: [{ queuePosition: "asc" }, { queuedAt: "asc" }],
  });

  if (!nextTicket) return null;

  await client.appointment.update({
    where: { id: nextTicket.id },
    data: {
      queueStatus: QueueStatus.IN_SERVICE,
      status: appointmentStatusForQueueStatus(QueueStatus.IN_SERVICE),
      queuePosition: 1,
      checkedInAt: new Date(),
    },
  });

  return nextTicket.id;
}

async function firstWaitingQueuePosition(
  client: Pick<QueueLifecycleClient, "appointment">,
  input: { barberShopId: string; staffMemberId: string },
) {
  const result = await client.appointment.aggregate({
    where: {
      barberShopId: input.barberShopId,
      staffMemberId: input.staffMemberId,
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
