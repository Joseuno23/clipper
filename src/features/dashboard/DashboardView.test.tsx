import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardView } from "./DashboardView";

const {
  reportsSales,
  appointmentsListByDate,
  queueLive,
  salesList,
  productsList,
} = vi.hoisted(() => ({
  reportsSales: vi.fn(),
  appointmentsListByDate: vi.fn(),
  queueLive: vi.fn(),
  salesList: vi.fn(),
  productsList: vi.fn(),
}));

vi.mock("@/shared/api/reports", () => ({
  reportKeys: {
    sales: (params: unknown) => ["reports", "sales", params],
  },
  reportsApi: { sales: reportsSales },
}));

vi.mock("@/shared/api/appointments", () => ({
  appointmentKeys: {
    all: ["appointments"],
    listByDate: (date: string) => ["appointments", "date", date],
  },
  appointmentsApi: { listByDate: appointmentsListByDate },
}));

vi.mock("@/shared/api/queue", () => ({
  queueKeys: { live: ["queue", "live"] },
  queueApi: { live: queueLive },
}));

vi.mock("@/shared/api/sales", () => ({
  salesKeys: {
    list: (params: unknown) => ["sales", "list", params],
  },
  salesApi: { list: salesList },
}));

vi.mock("@/shared/api/adminCrud", () => ({
  adminCrudKeys: {
    productsList: (params: unknown) => [
      "adminCrud",
      "products",
      "list",
      params,
    ],
  },
  productsApi: { list: productsList },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardView />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("DashboardView", () => {
  it("renders dashboard sections from API-backed data", async () => {
    reportsSales.mockResolvedValue({
      summary: {
        totalRevenue: "120000.00",
        servicesRevenue: "90000.00",
        productsRevenue: "30000.00",
        orderCount: 3,
        itemLineCount: 4,
        quantityTotal: 4,
      },
      days: [],
    });
    appointmentsListByDate.mockResolvedValue([
      {
        id: "appt_1",
        clientName: "Ada Lovelace",
        staffName: "Grace Hopper",
        status: "SCHEDULED",
        startAt: "2026-01-01T14:00:00.000Z",
        endAt: "2026-01-01T14:45:00.000Z",
        queueStatus: "NOT_QUEUED",
        queuedAt: null,
        queuePosition: null,
        serviceName: "Classic Cut",
        serviceDurationMinutes: 45,
        servicePrice: "1500.00",
        services: [],
      },
    ]);
    queueLive.mockResolvedValue({
      queues: [
        {
          staffId: "staff_1",
          staffName: "Grace Hopper",
          roles: [],
          specialties: [],
          inServiceCount: 0,
          waitingCount: 1,
          totalActiveCount: 1,
          tickets: [
            {
              id: "queue_1",
              queueStatus: "WAITING",
              queuedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
            },
          ],
        },
      ],
    });
    salesList.mockResolvedValue([{ id: "sale_1" }, { id: "sale_2" }]);
    productsList.mockResolvedValue([
      {
        id: "product_1",
        name: "Pomade",
        currentStock: 1,
        lowStockAt: 2,
      },
    ]);

    renderDashboard();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText(/Classic Cut/)).toBeInTheDocument();
    expect(screen.getByText("Pomade")).toBeInTheDocument();
    expect(screen.getByText("3 ventas cobradas")).toBeInTheDocument();
    expect(screen.getByText("ventas abiertas")).toBeInTheDocument();
    expect(screen.queryByText("Iván Soto sin disponibilidad")).toBeNull();
    expect(screen.getByRole("link", { name: "Nueva cita" })).toHaveAttribute(
      "href",
      "/appointments",
    );
    expect(screen.getByRole("link", { name: "Cobrar" })).toHaveAttribute(
      "href",
      "/sales",
    );
    expect(screen.getByRole("link", { name: "Cliente" })).toHaveAttribute(
      "href",
      "/customers",
    );
    expect(screen.getByRole("link", { name: "Cola" })).toHaveAttribute(
      "href",
      "/queue",
    );
  });
});
