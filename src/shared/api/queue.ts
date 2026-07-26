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
};

export type StaffQueueDto = {
  staffId: string;
  staffName: string;
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
  clientId: string;
  serviceId: string;
  staffMemberId: string;
};

export type QueueUpdateInput = {
  staffMemberId?: string;
  queueStatus?: QueueStatus;
};

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
};
