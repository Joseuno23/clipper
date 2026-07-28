import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

// Recharts' ResponsiveContainer renders with zero size in jsdom, so we stub the
// pieces used by the sales chart to render the underlying data as testable DOM.
vi.mock("recharts", () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    ResponsiveContainer: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    BarChart: ({
      data,
      children,
    }: {
      data: { label: string; totalRevenue: number }[];
      children?: React.ReactNode;
    }) => (
      <div data-testid="sales-bar-chart">
        {children}
        {data.map((point) => (
          <div key={point.label} data-testid="sales-bar">
            {point.label}: {point.totalRevenue}
          </div>
        ))}
      </div>
    ),
    Bar: () => null,
  };
});

vi.mock("@/shared/api/auth", () => ({
  authKeys: { me: ["auth", "me"] },
  me: vi.fn().mockResolvedValue({
    user: {
      id: "user_1",
      email: "admin@clipper.test",
      displayName: "Admin User",
      status: "ACTIVE",
    },
    tenant: {
      barberShopId: "shop_1",
      name: "Clipper Test",
      slug: "niche-72",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    },
    membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
    tokenClaims: {},
  }),
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

    expect(
      await screen.findByRole("heading", { name: "Buenos días, Admin User" }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByText("No hay ventas para el rango seleccionado."),
    ).toBeInTheDocument();
  });

  it("renders the sales-by-day chart from report days and queries last 7 days by default", async () => {
    stubSupportingQueries();
    reportsSales.mockResolvedValue({
      summary: {
        totalRevenue: "300.00",
        servicesRevenue: "0",
        productsRevenue: "0",
        orderCount: 0,
        itemLineCount: 0,
        quantityTotal: 0,
      },
      days: [
        { date: "2026-07-27", totalRevenue: "100.00", items: [] },
        { date: "2026-07-28", totalRevenue: "200.00", items: [] },
      ],
    });

    renderDashboard();

    expect(await screen.findByText("Ventas por día")).toBeInTheDocument();
    const bars = await screen.findAllByTestId("sales-bar");
    expect(bars).toHaveLength(2);
    expect(bars[0]).toHaveTextContent("27 de jul: 100");
    expect(bars[1]).toHaveTextContent("28 de jul: 200");

    // Default preset is "last 7 days": today minus 6 days through today.
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 6);
    const key = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);

    expect(reportsSales).toHaveBeenCalledWith(
      expect.objectContaining({ from: key(from), to: key(today) }),
    );
  });

  it("changes the reports query range when a filter is selected", async () => {
    stubSupportingQueries();
    reportsSales.mockResolvedValue({
      summary: {
        totalRevenue: "0",
        servicesRevenue: "0",
        productsRevenue: "0",
        orderCount: 0,
        itemLineCount: 0,
        quantityTotal: 0,
      },
      days: [],
    });

    renderDashboard();

    await screen.findByText("Ventas por día");

    const key = (d: Date) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
    const today = new Date();

    await userEvent.click(screen.getByRole("button", { name: "Mes" }));
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    await waitFor(() => {
      expect(reportsSales).toHaveBeenCalledWith(
        expect.objectContaining({ from: key(monthStart), to: key(today) }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Año" }));
    const yearStart = new Date(today.getFullYear(), 0, 1);
    await waitFor(() => {
      expect(reportsSales).toHaveBeenCalledWith(
        expect.objectContaining({ from: key(yearStart), to: key(today) }),
      );
    });
  });
});

function stubSupportingQueries() {
  appointmentsListByDate.mockResolvedValue([]);
  queueLive.mockResolvedValue({ queues: [] });
  salesList.mockResolvedValue([]);
  productsList.mockResolvedValue([]);
}
