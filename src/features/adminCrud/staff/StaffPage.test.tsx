import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { ServiceDto, StaffDto } from "@/shared/api/adminCrud";

import { StaffCrudPage } from "./StaffPage";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("StaffCrudPage", () => {
  it("renders staff rows from the API", async () => {
    stubFetch([
      {
        ok: true,
        data: [
          makeStaff({
            displayName: "Ada L.",
            roles: ["BARBER", "COLORIST"],
            specialties: ["Corte", "Color"],
            commissionMode: "PERCENTAGE_BPS",
            commissionValue: "1500",
          }),
        ],
      },
    ]);

    renderStaffPage();

    expect(await screen.findByText("Ada L.")).toBeInTheDocument();
    expect(screen.getByText("Barbero, Colorista")).toBeInTheDocument();
    expect(screen.getByText("Corte, Color")).toBeInTheDocument();
    expect(
      screen.queryByRole("columnheader", { name: /comisi[oó]n/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText("Porcentaje · 15%")).not.toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("refreshes the list after creating a staff member", async () => {
    const fetchMock = stubFetch([
      { ok: true, data: [] },
      { ok: true, data: [makeService()] },
      { ok: true, data: makeStaff({ displayName: "Grace H." }) },
      { ok: true, data: [makeStaff({ displayName: "Grace H." })] },
    ]);
    renderStaffPage();

    await screen.findByText("Todavía no hay staff");
    await userEvent.click(screen.getByRole("button", { name: "Nuevo staff" }));
    await userEvent.type(screen.getByLabelText("Nombre"), "Grace");
    await userEvent.type(screen.getByLabelText("Apellido"), "Hopper");
    await userEvent.type(screen.getByLabelText("Nombre visible"), "Grace H.");
    await userEvent.type(
      screen.getByLabelText("Especialidades"),
      "Barba, Color",
    );
    await userEvent.click(screen.getByLabelText("Barbero"));
    expect(await screen.findByText("Classic Cut")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Modo de comisión para Classic Cut"),
      "PERCENTAGE_BPS",
    );
    await userEvent.clear(
      screen.getByLabelText("Valor de comisión para Classic Cut"),
    );
    await userEvent.type(
      screen.getByLabelText("Valor de comisión para Classic Cut"),
      "30",
    );
    expect(screen.queryByLabelText("Modo de comisión")).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Valor de comisión"),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Grace H.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          firstName: "Grace",
          lastName: "Hopper",
          displayName: "Grace H.",
          email: null,
          phone: null,
          isActive: true,
          commissionMode: "NONE",
          commissionValue: "0",
          specialties: ["Barba", "Color"],
          roles: ["BARBER"],
          serviceCommissions: [
            {
              serviceId: "service_1",
              commissionMode: "PERCENTAGE_BPS",
              commissionValue: "3000",
            },
          ],
        }),
      }),
    );
  });

  it("filters services by selected staff roles and submits per-service commissions", async () => {
    const fetchMock = stubFetch([
      { ok: true, data: [makeStaff()] },
      {
        ok: true,
        data: [
          makeService({
            id: "cut",
            name: "Classic Cut",
            allowedRoles: ["BARBER"],
          }),
          makeService({
            id: "color",
            name: "Color",
            allowedRoles: ["COLORIST"],
          }),
        ],
      },
      { ok: true, data: makeStaff() },
      { ok: true, data: [makeStaff()] },
    ]);
    renderStaffPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Editar" }),
    );
    expect(await screen.findByText("Classic Cut")).toBeInTheDocument();
    expect(screen.queryByText("Color")).not.toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Colorista"));
    expect(await screen.findByText("Color")).toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByLabelText("Modo de comisión para Color"),
      "FIXED_AMOUNT",
    );
    await userEvent.clear(
      screen.getByLabelText("Valor de comisión para Color"),
    );
    await userEvent.type(
      screen.getByLabelText("Valor de comisión para Color"),
      "800",
    );
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/staff_1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"serviceId":"color"'),
      }),
    );
  });

  it("loads every services page before submitting staff commissions", async () => {
    const firstPage = Array.from({ length: 100 }, (_, index) =>
      makeService({
        id: `service_${index}`,
        name: `Service ${index}`,
      }),
    );
    const fetchMock = stubFetch([
      { ok: true, data: [makeStaff()] },
      { ok: true, data: firstPage },
      {
        ok: true,
        data: [
          makeService({
            id: "service_100",
            name: "Deep Page Cut",
          }),
        ],
      },
      { ok: true, data: makeStaff() },
      { ok: true, data: [makeStaff()] },
    ]);

    renderStaffPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Editar" }),
    );
    expect(await screen.findByText("Deep Page Cut")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/services?limit=100&offset=0",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/services?limit=100&offset=100",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/staff/staff_1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"serviceId":"service_100"'),
      }),
    );
  });

  it("shows server errors without losing entered form values", async () => {
    stubFetch([
      { ok: true, data: [] },
      { ok: true, data: [] },
      {
        ok: false,
        error: { code: "CONFLICT", message: "Staff already exists" },
        status: 409,
      },
    ]);
    renderStaffPage();

    await screen.findByText("Todavía no hay staff");
    await userEvent.click(screen.getByRole("button", { name: "Nuevo staff" }));
    await userEvent.type(screen.getByLabelText("Nombre"), "Ada");
    await userEvent.type(screen.getByLabelText("Apellido"), "Lovelace");
    await userEvent.type(screen.getByLabelText("Nombre visible"), "Ada L.");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Staff already exists")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre visible")).toHaveValue("Ada L.");
  });

  it("requests the next offset when clicking Next", async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      makeStaff({ id: `staff_${index}`, displayName: `Staff ${index}` }),
    );
    const fetchMock = stubFetch([
      { ok: true, data: firstPage },
      {
        ok: true,
        data: [makeStaff({ id: "staff_10", displayName: "Staff 10" })],
      },
    ]);

    renderStaffPage();

    await screen.findByText("Staff 0");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await screen.findByText("Staff 10");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/staff?limit=10&offset=10",
      expect.any(Object),
    );
  });
});

function renderStaffPage() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StaffCrudPage />
    </QueryClientProvider>,
  );
}

type StubResponse =
  | { ok: true; data: unknown; status?: number }
  | {
      ok: false;
      error: { code: string; message: string; details?: unknown };
      status?: number;
    };

function stubFetch(responses: StubResponse[]) {
  const fetchMock = vi.fn().mockImplementation(() => {
    const response = responses.shift();

    if (!response) {
      throw new Error("Unexpected fetch call");
    }

    const status = response.status ?? (response.ok ? 200 : 400);
    return Promise.resolve(Response.json(response, { status }));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeStaff(overrides: Partial<StaffDto> = {}): StaffDto {
  return {
    id: "staff_1",
    userId: null,
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada L.",
    email: "ada@clipper.test",
    phone: null,
    isActive: true,
    commissionMode: "NONE",
    commissionValue: "0.00",
    workingDays: [],
    restDays: [],
    specialties: ["Corte"],
    roles: ["BARBER"],
    serviceCommissions: [
      {
        serviceId: "cut",
        commissionMode: "PERCENTAGE_BPS",
        commissionValue: "1500.00",
      },
    ],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeService(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    id: "service_1",
    name: "Classic Cut",
    description: null,
    durationMinutes: 45,
    basePrice: "1500.00",
    isActive: true,
    allowedRoles: ["BARBER"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
