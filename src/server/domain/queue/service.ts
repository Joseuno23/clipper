import {
  AppointmentStatus,
  QueueStatus,
} from "../../../generated/prisma/enums";
import { ApiError } from "../../api/errors";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  LiveQueuesDto,
  QueueCreateInput,
  QueueRepository,
  QueueStaffRecord,
  QueueTicketDto,
  QueueTicketRecord,
  QueueUpdateInput,
} from "./types";

export function createQueueService(repository: QueueRepository) {
  return {
    async list(context: AuthContext): Promise<LiveQueuesDto> {
      const records = await repository.listLiveQueues({
        barberShopId: context.tenant.barberShopId,
      });

      return { queues: records.map(toStaffQueueDto) };
    },

    async createWalkIn(
      context: AuthContext,
      data: QueueCreateInput,
      queuedAt = new Date(),
    ) {
      requireAdminCapable(context);
      const barberShopId = context.tenant.barberShopId;

      await assertActiveClient(repository, barberShopId, data.clientId);
      await assertActiveStaff(repository, barberShopId, data.staffMemberId);
      const service = await repository.findActiveService({
        barberShopId,
        serviceId: data.serviceId,
      });

      if (!service) throw queueReferenceNotFound("service");

      return toQueueTicketDto(
        await repository.createWalkIn({
          barberShopId,
          data,
          service,
          queuedAt,
        }),
      );
    },

    async updateTicket(
      context: AuthContext,
      ticketId: string,
      data: QueueUpdateInput,
    ) {
      requireAdminCapable(context);
      const barberShopId = context.tenant.barberShopId;

      if (data.staffMemberId) {
        await assertActiveStaff(repository, barberShopId, data.staffMemberId);
      }

      const ticket = await repository.updateTicket({
        barberShopId,
        ticketId,
        data,
      });

      if (!ticket) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "Queue ticket was not found.",
        });
      }

      return toQueueTicketDto(ticket);
    },
  };
}

function toStaffQueueDto(record: QueueStaffRecord) {
  const tickets = record.tickets.map(toQueueTicketDto);

  return {
    staffId: record.id,
    staffName: record.displayName || `${record.firstName} ${record.lastName}`,
    roles: record.roles.map(({ role }) => role),
    specialties: record.specialties,
    inServiceCount: tickets.filter(
      (ticket) => ticket.queueStatus === QueueStatus.IN_SERVICE,
    ).length,
    waitingCount: tickets.filter(
      (ticket) =>
        ticket.queueStatus === QueueStatus.WAITING ||
        ticket.queueStatus === QueueStatus.CALLED,
    ).length,
    totalActiveCount: tickets.length,
    tickets,
  };
}

export function toQueueTicketDto(record: QueueTicketRecord): QueueTicketDto {
  const primaryService = [...record.services].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  )[0];

  return {
    id: record.id,
    clientId: record.clientId,
    clientName: record.client
      ? `${record.client.firstName} ${record.client.lastName}`
      : "Cliente sin asignar",
    staffMemberId: record.staffMemberId,
    status: record.status,
    queueStatus: record.queueStatus,
    queuedAt: record.queuedAt?.toISOString() ?? null,
    queuePosition: record.queuePosition,
    serviceName: primaryService?.serviceNameSnapshot ?? null,
    serviceDurationMinutes: primaryService?.serviceDurationSnapshot ?? null,
    servicePrice: primaryService?.servicePriceSnapshot.toString() ?? null,
  };
}

export function appointmentStatusForQueueStatus(queueStatus: QueueStatus) {
  if (queueStatus === QueueStatus.IN_SERVICE)
    return AppointmentStatus.IN_SERVICE;
  if (queueStatus === QueueStatus.SERVED) return AppointmentStatus.COMPLETED;
  if (queueStatus === QueueStatus.LEFT) return AppointmentStatus.CANCELLED;
  return AppointmentStatus.CHECKED_IN;
}

async function assertActiveClient(
  repository: QueueRepository,
  barberShopId: string,
  clientId: string,
) {
  const client = await repository.findActiveClient({ barberShopId, clientId });
  if (!client) throw queueReferenceNotFound("client");
}

async function assertActiveStaff(
  repository: QueueRepository,
  barberShopId: string,
  staffMemberId: string,
) {
  const staff = await repository.findActiveStaff({
    barberShopId,
    staffMemberId,
  });
  if (!staff) throw queueReferenceNotFound("staff member");
}

function queueReferenceNotFound(reference: string) {
  return new ApiError({
    code: "BAD_REQUEST",
    message: `Walk-in queue ticket references an inactive or missing ${reference}.`,
  });
}
