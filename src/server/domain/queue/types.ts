import type {
  AppointmentStatus,
  QueueStatus,
  StaffRole,
} from "../../../generated/prisma/enums";

export type QueueServiceSnapshotRecord = {
  id: string;
  serviceId: string | null;
  serviceNameSnapshot: string;
  servicePriceSnapshot: { toString(): string };
  serviceDurationSnapshot: number;
  sortOrder: number;
};

export type QueueTicketRecord = {
  id: string;
  clientId: string | null;
  staffMemberId: string | null;
  status: AppointmentStatus;
  queueStatus: QueueStatus;
  queuedAt: Date | null;
  queuePosition: number | null;
  checkedInAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; firstName: string; lastName: string } | null;
  services: QueueServiceSnapshotRecord[];
};

export type QueueStaffRecord = {
  id: string;
  displayName: string;
  firstName: string;
  lastName: string;
  roles: { role: StaffRole }[];
  specialties: string[];
  tickets: QueueTicketRecord[];
};

export type QueueServiceRecord = {
  id: string;
  name: string;
  durationMinutes: number;
  price: { toString(): string };
};

export type QueueCreateInput = {
  serviceIds: string[];
  staffMemberId: string;
  client:
    | { kind: "existing"; clientId: string }
    | {
        kind: "new";
        firstName: string;
        lastName: string;
        phone: string | null;
        normalizedPhone: string | null;
        documentNumber: string | null;
        normalizedDocument: string | null;
      };
};

export type QueueUpdateInput = {
  staffMemberId?: string;
  queueStatus?: QueueStatus;
  positionAction?: QueuePositionAction;
  clientId?: string;
  serviceIds?: string[];
};

export type QueuePositionAction =
  "UP" | "DOWN" | "FIRST_WAITING" | "LAST" | "CHAIR";

export type QueueTicketServiceDto = {
  serviceId: string | null;
  name: string;
  durationMinutes: number;
  price: string;
};

export type QueueTicketDto = {
  id: string;
  clientId: string | null;
  clientName: string;
  staffMemberId: string | null;
  status: AppointmentStatus;
  queueStatus: QueueStatus;
  queuedAt: string | null;
  queuePosition: number | null;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
  servicePrice: string | null;
  services: QueueTicketServiceDto[];
};

export type StaffQueueDto = {
  staffId: string;
  staffName: string;
  roles: StaffRole[];
  specialties: string[];
  inServiceCount: number;
  waitingCount: number;
  totalActiveCount: number;
  tickets: QueueTicketDto[];
};

export type LiveQueuesDto = {
  queues: StaffQueueDto[];
};

export type QueueRepository = {
  listLiveQueues(input: { barberShopId: string }): Promise<QueueStaffRecord[]>;
  findActiveClient(input: {
    barberShopId: string;
    clientId: string;
  }): Promise<{ id: string } | null>;
  findActiveStaff(input: {
    barberShopId: string;
    staffMemberId: string;
  }): Promise<{ id: string } | null>;
  findActiveService(input: {
    barberShopId: string;
    serviceId: string;
  }): Promise<QueueServiceRecord | null>;
  findActiveServices(input: {
    barberShopId: string;
    serviceIds: string[];
  }): Promise<QueueServiceRecord[]>;
  createWalkIn(input: {
    barberShopId: string;
    data: QueueCreateInput;
    services: QueueServiceRecord[];
    queuedAt: Date;
  }): Promise<QueueTicketRecord>;
  updateTicket(input: {
    barberShopId: string;
    ticketId: string;
    data: QueueUpdateInput;
    services?: QueueServiceRecord[];
  }): Promise<QueueTicketRecord | null>;
};
