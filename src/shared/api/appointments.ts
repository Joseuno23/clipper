import { adminRequest } from "./adminCrud/client";
import type { QueueCreateInput, QueueTicketDto } from "./queue";

export type AppointmentListItemDto = QueueTicketDto & {
  staffName: string | null;
};

export type AppointmentCreateInput = QueueCreateInput & {
  startAt: string;
};

const APPOINTMENTS_PATH = "/api/appointments";

export const appointmentKeys = {
  all: ["appointments"] as const,
  listByDate: (date: string) => [...appointmentKeys.all, "date", date] as const,
};

export const appointmentsApi = {
  listByDate: (date: string) => {
    const params = new URLSearchParams({ date });
    return adminRequest<AppointmentListItemDto[]>(
      `${APPOINTMENTS_PATH}?${params.toString()}`,
    );
  },
  createScheduled: (input: AppointmentCreateInput) =>
    adminRequest<QueueTicketDto>(APPOINTMENTS_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
};
