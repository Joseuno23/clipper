import {
  AppointmentStatus,
  QueueStatus,
} from "../../../generated/prisma/enums";
import { BUSINESS_TIME_ZONE } from "../../../shared/lib/businessLocale";
import { ApiError } from "../../api/errors";
import { getShopLocalDayBoundariesForDateKey } from "../../timezone";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  AppointmentListItemDto,
  AppointmentListItemRecord,
  LiveQueuesDto,
  QueueCreateInput,
  QueueCancelInput,
  QueueRepository,
  ScheduledAppointmentCreateInput,
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

    async listAppointmentsByDate(
      context: AuthContext,
      input: { date: string },
    ): Promise<AppointmentListItemDto[]> {
      const boundaries = getShopLocalDayBoundariesForDateKey(
        context.tenant.timezone || BUSINESS_TIME_ZONE,
        input.date,
      );
      const records = await repository.listAppointmentsByDate({
        barberShopId: context.tenant.barberShopId,
        from: boundaries.startsAt,
        toExclusive: boundaries.endsAt,
      });

      return records.map(toAppointmentListItemDto);
    },

    async createWalkIn(
      context: AuthContext,
      data: QueueCreateInput,
      queuedAt = new Date(),
    ) {
      requireAdminCapable(context);
      const barberShopId = context.tenant.barberShopId;
      const timeZone = context.tenant.timezone || BUSINESS_TIME_ZONE;

      if (data.client.kind === "existing") {
        await assertActiveClient(
          repository,
          barberShopId,
          data.client.clientId,
        );
      }
      await assertActiveStaff(repository, barberShopId, data.staffMemberId);
      const services = await repository.findActiveServices({
        barberShopId,
        serviceIds: data.serviceIds,
      });

      if (services.length !== data.serviceIds.length) {
        throw queueReferenceNotFound("service");
      }

      const servicesById = new Map(
        services.map((service) => [service.id, service]),
      );
      const orderedServices = data.serviceIds.map((serviceId) =>
        servicesById.get(serviceId)!,
      );

      try {
        return toQueueTicketDto(
          await repository.createWalkIn({
            barberShopId,
            timeZone,
            data,
            services: orderedServices,
            queuedAt,
          }),
        );
      } catch (error) {
        throw mapQueueCreateError(error);
      }
    },

    async createScheduledAppointment(
      context: AuthContext,
      data: ScheduledAppointmentCreateInput,
      now = new Date(),
    ) {
      requireAdminCapable(context);
      const barberShopId = context.tenant.barberShopId;
      const timeZone = context.tenant.timezone || BUSINESS_TIME_ZONE;

      if (data.client.kind === "existing") {
        await assertActiveClient(
          repository,
          barberShopId,
          data.client.clientId,
        );
      }
      await assertActiveStaff(repository, barberShopId, data.staffMemberId);
      const services = await findOrderedActiveServices(
        repository,
        barberShopId,
        data.serviceIds,
      );

      try {
        return toQueueTicketDto(
          await repository.createScheduledAppointment({
            barberShopId,
            timeZone,
            data,
            services,
            now,
          }),
        );
      } catch (error) {
        throw mapQueueCreateError(error);
      }
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
      if (data.clientId) {
        await assertActiveClient(repository, barberShopId, data.clientId);
      }
      const services = data.serviceIds
        ? await findOrderedActiveServices(
            repository,
            barberShopId,
            data.serviceIds,
          )
        : undefined;

      const ticket = await repository.updateTicket({
        barberShopId,
        ticketId,
        data,
        services,
      });

      if (!ticket) {
        throw new ApiError({
          code: "NOT_FOUND",
          message: "Queue ticket was not found.",
        });
      }

      return toQueueTicketDto(ticket);
    },

    async cancelTicket(
      context: AuthContext,
      ticketId: string,
      data: QueueCancelInput,
    ) {
      requireAdminCapable(context);
      const ticket = await repository.cancelTicket({
        barberShopId: context.tenant.barberShopId,
        ticketId,
        reason: data.reason,
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
    staffPhotoDataUrl: record.photoDataUrl,
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
    source: record.source,
    startAt: record.startAt.toISOString(),
    endAt: record.endAt.toISOString(),
    queueStatus: record.queueStatus,
    queuedAt: record.queuedAt?.toISOString() ?? null,
    checkedInAt: record.checkedInAt?.toISOString() ?? null,
    queuePosition: record.queuePosition,
    serviceName: primaryService?.serviceNameSnapshot ?? null,
    serviceDurationMinutes: primaryService?.serviceDurationSnapshot ?? null,
    servicePrice: primaryService?.servicePriceSnapshot.toString() ?? null,
    services: [...record.services]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((service) => ({
        serviceId: service.serviceId,
        name: service.serviceNameSnapshot,
        durationMinutes: service.serviceDurationSnapshot,
        price: service.servicePriceSnapshot.toString(),
      })),
  };
}

function toAppointmentListItemDto(
  record: AppointmentListItemRecord,
): AppointmentListItemDto {
  const ticket = toQueueTicketDto(record);

  return {
    ...ticket,
    staffName: record.staffMember
      ? record.staffMember.displayName ||
        `${record.staffMember.firstName} ${record.staffMember.lastName}`
      : null,
  };
}

async function findOrderedActiveServices(
  repository: QueueRepository,
  barberShopId: string,
  serviceIds: string[],
) {
  const services = await repository.findActiveServices({
    barberShopId,
    serviceIds,
  });

  if (services.length !== serviceIds.length) {
    throw queueReferenceNotFound("service");
  }

  const servicesById = new Map(
    services.map((service) => [service.id, service]),
  );
  return serviceIds.map((serviceId) => servicesById.get(serviceId)!);
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

function mapQueueCreateError(error: unknown) {
  if (error instanceof ApiError) return error;

  if (isUniqueConstraintError(error)) {
    return new ApiError({
      code: "CONFLICT",
      message: "Client already exists for this barber shop.",
    });
  }

  return error;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}
