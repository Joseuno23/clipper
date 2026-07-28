import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppointmentListItemDto } from "@/shared/api/appointments";

const {
  appointmentsCreateScheduled,
  appointmentsListByDate,
  customersList,
  queueCreateWalkIn,
  servicesList,
  staffList,
} = vi.hoisted(() => ({
  appointmentsCreateScheduled: vi.fn(),
  appointmentsListByDate: vi.fn(),
  customersList: vi.fn(),
  queueCreateWalkIn: vi.fn(),
  servicesList: vi.fn(),
  staffList: vi.fn(),
}));

vi.mock("@/shared/api/appointments", () => ({
  appointmentKeys: {
    all: ["appointments"],
    listByDate: (date: string) => ["appointments", "date", date],
  },
  appointmentsApi: {
    createScheduled: appointmentsCreateScheduled,
    listByDate: appointmentsListByDate,
  },
}));

vi.mock("@/shared/api/adminCrud", () => ({
  AdminCrudApiError: class AdminCrudApiError extends Error {},
  adminCrudKeys: {
    customersList: (params: unknown) => ["customers", "list", params],
    servicesList: (params: unknown) => ["services", "list", params],
    staffList: (params: unknown) => ["staff", "list", params],
  },
  customersApi: { list: customersList },
  servicesApi: { list: servicesList },
  staffApi: { list: staffList },
}));

vi.mock("@/shared/api/queue", () => ({
  queueKeys: { live: ["queue", "live"] },
  queueApi: {
    createWalkIn: queueCreateWalkIn,
    live: vi.fn(),
    updateTicket: vi.fn(),
    cancelTicket: vi.fn(),
  },
}));

vi.mock("@/shared/api/sales", () => ({
  salesKeys: { all: ["sales"] },
}));

import { AppointmentsView } from "./AppointmentsView";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("AppointmentsView", () => {
  it("opens the walk-in dialog from Nuevo turno", async () => {
    appointmentsListByDate.mockResolvedValue([]);
    staffList.mockResolvedValue([makeStaff()]);

    renderAppointmentsView();

    await userEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));

    expect(
      await screen.findByRole("dialog", { name: "Nuevo turno walk-in" }),
    ).toBeInTheDocument();
  });

  it("opens the scheduled appointment dialog from Nueva cita", async () => {
    appointmentsListByDate.mockResolvedValue([]);
    staffList.mockResolvedValue([makeStaff()]);

    renderAppointmentsView();

    await userEvent.click(screen.getByRole("button", { name: "Nueva cita" }));

    expect(
      await screen.findByRole("dialog", { name: "Nueva cita" }),
    ).toBeInTheDocument();
  });

  it("loads appointments from the API for today's business date", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0));
    appointmentsListByDate.mockResolvedValue([
      makeAppointment({
        id: "appt_1",
        clientName: "Ada Lovelace",
        staffName: "Grace Hopper",
        status: "CONFIRMED",
        source: "PHONE",
        serviceName: "Corte clásico",
      }),
    ]);

    renderAppointmentsView();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Origen: Teléfono")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();
    expect(screen.getByText("Confirmada")).toBeInTheDocument();
    expect(appointmentsListByDate).toHaveBeenCalledWith("2026-01-15");
  });

  it("filters API appointments by status tabs with fetched counts", async () => {
    appointmentsListByDate.mockResolvedValue([
      makeAppointment({ id: "scheduled", clientName: "Scheduled Client" }),
      makeAppointment({
        id: "checked_in",
        clientName: "Checked Client",
        status: "CHECKED_IN",
      }),
      makeAppointment({
        id: "in_service",
        clientName: "Busy Client",
        status: "IN_SERVICE",
      }),
      makeAppointment({
        id: "completed",
        clientName: "Done Client",
        status: "COMPLETED",
      }),
      makeAppointment({
        id: "cancelled",
        clientName: "Cancelled Client",
        status: "CANCELLED",
      }),
    ]);

    renderAppointmentsView();

    expect(await screen.findByText("Scheduled Client")).toBeInTheDocument();
    expect(tabButton("Todas")).toHaveTextContent("5");
    expect(tabButton("Programadas")).toHaveTextContent("2");
    expect(tabButton("En curso")).toHaveTextContent("1");
    expect(tabButton("Completadas")).toHaveTextContent("1");

    await userEvent.click(tabButton("En curso"));

    expect(screen.getByText("Busy Client")).toBeInTheDocument();
    expect(screen.queryByText("Scheduled Client")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled Client")).not.toBeInTheDocument();
  });

  it("changes the API date from the filter panel and Hoy resets it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 0, 15, 12, 0));
    appointmentsListByDate.mockResolvedValue([]);

    renderAppointmentsView();

    await screen.findByText("No hay citas para este filtro.");
    await userEvent.click(screen.getByRole("button", { name: "Filtros" }));
    fireEvent.change(screen.getByLabelText("Día"), {
      target: { value: "2026-01-20" },
    });

    await waitFor(() =>
      expect(appointmentsListByDate).toHaveBeenCalledWith("2026-01-20"),
    );

    await userEvent.click(screen.getByRole("button", { name: "Hoy" }));

    await waitFor(() =>
      expect(appointmentsListByDate).toHaveBeenCalledWith("2026-01-15"),
    );
  });

  it("shows loading and error states without fake rows", async () => {
    appointmentsListByDate.mockRejectedValue(new Error("boom"));

    renderAppointmentsView();

    expect(screen.getByText("Cargando citas…")).toBeInTheDocument();
    expect(
      await screen.findByText("No se pudieron cargar las citas."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Iván Soto")).not.toBeInTheDocument();
  });
});

function renderAppointmentsView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <AppointmentsView />
    </QueryClientProvider>,
  );
}

function tabButton(name: string) {
  return screen.getByRole("button", { name: new RegExp(name) });
}

function makeAppointment(
  overrides: Partial<AppointmentListItemDto> = {},
): AppointmentListItemDto {
  return {
    id: "appt_1",
    clientId: "client_1",
    clientName: "Ana Paz",
    staffMemberId: "staff_1",
    staffName: "Ana Barber",
    status: "SCHEDULED",
    source: "ONLINE",
    startAt: "2026-01-15T14:00:00.000Z",
    endAt: "2026-01-15T14:45:00.000Z",
    queueStatus: "NOT_QUEUED",
    queuedAt: null,
    checkedInAt: null,
    queuePosition: null,
    serviceName: "Corte clásico",
    serviceDurationMinutes: 45,
    servicePrice: "2500.00",
    services: [
      {
        serviceId: "service_1",
        name: "Corte clásico",
        durationMinutes: 45,
        price: "2500.00",
      },
    ],
    ...overrides,
  };
}

function makeStaff() {
  return {
    id: "staff_1",
    userId: "user_1",
    firstName: "Ana",
    lastName: "Barber",
    displayName: "Ana Barber",
    email: "ana@example.com",
    phone: null,
    roles: ["BARBER"],
    specialties: [],
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}
