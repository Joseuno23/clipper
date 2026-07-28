import { adminRequest } from "./adminCrud/client";

export type QueueStatus =
  "NOT_QUEUED" | "WAITING" | "CALLED" | "IN_SERVICE" | "SERVED" | "LEFT";

export type AppointmentStatus =
  | "SCHEDULED"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "IN_SERVICE"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export type AppointmentSource = "WALK_IN" | "PHONE" | "ONLINE" | "STAFF";

export type QueueTicketDto = {
  id: string;
  clientId: string | null;
  clientName: string;
  staffMemberId: string | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  startAt: string;
  endAt: string;
  queueStatus: QueueStatus;
  queuedAt: string | null;
  checkedInAt: string | null;
  queuePosition: number | null;
  serviceName: string | null;
  serviceDurationMinutes: number | null;
  servicePrice: string | null;
  services: QueueTicketServiceDto[];
};

export type QueueTicketServiceDto = {
  serviceId: string | null;
  name: string;
  durationMinutes: number;
  price: string;
};

export type StaffQueueDto = {
  staffId: string;
  staffName: string;
  staffPhotoDataUrl: string | null;
  roles: string[];
  specialties: string[];
  inServiceCount: number;
  waitingCount: number;
  totalActiveCount: number;
  tickets: QueueTicketDto[];
};

export type LiveQueuesDto = {
  queues: StaffQueueDto[];
};

export type QueueCreateInput = {
  serviceIds: string[];
  serviceId?: string;
  staffMemberId: string;
  client:
    | { kind: "existing"; clientId: string }
    | {
        kind: "new";
        firstName: string;
        lastName: string;
        phone?: string | null;
        documentNumber?: string | null;
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

const QUEUE_PATH = "/api/queue";

export const queueKeys = {
  live: ["queue", "live"] as const,
};

export const queueApi = {
  live: () => adminRequest<LiveQueuesDto>(QUEUE_PATH),
  createWalkIn: (input: QueueCreateInput) =>
    adminRequest<QueueTicketDto>(QUEUE_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  updateTicket: (id: string, input: QueueUpdateInput) =>
    adminRequest<QueueTicketDto>(`${QUEUE_PATH}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  cancelTicket: (id: string, input: { reason: string }) =>
    adminRequest<QueueTicketDto>(`${QUEUE_PATH}/${id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
};
