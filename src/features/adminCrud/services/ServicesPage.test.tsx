import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { ServiceDto } from "@/shared/api/adminCrud";

import { ServicesCrudPage } from "./ServicesPage";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("ServicesCrudPage", () => {
  it("renders service rows from the API", async () => {
    stubFetch([
      {
        ok: true,
        data: [
          makeService({ name: "Corte clásico", description: "Servicio base" }),
        ],
      },
    ]);

    renderServicesPage();

    expect(await screen.findByText("Corte clásico")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Barbero")).toBeInTheDocument();
  });

  it("refreshes the list after creating a service", async () => {
    const fetchMock = stubFetch([
      { ok: true, data: [] },
      { ok: true, data: makeService({ name: "Perfilado" }) },
      { ok: true, data: [makeService({ name: "Perfilado" })] },
    ]);
    renderServicesPage();

    await screen.findByText("Todavía no hay servicios");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo servicio" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Perfilado");
    await userEvent.type(screen.getByLabelText("Duración (minutos)"), "30");
    await userEvent.type(screen.getByLabelText("Precio base"), "1800");
    await userEvent.click(screen.getByLabelText("Barbero"));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Perfilado")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/services",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Perfilado",
          description: null,
          durationMinutes: 30,
          basePrice: "1800",
          allowedRoles: ["BARBER"],
        }),
      }),
    );
  });

  it("shows server errors without losing entered form values", async () => {
    stubFetch([
      { ok: true, data: [] },
      {
        ok: false,
        error: { code: "CONFLICT", message: "Service already exists" },
        status: 409,
      },
    ]);
    renderServicesPage();

    await screen.findByText("Todavía no hay servicios");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo servicio" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Corte");
    await userEvent.type(screen.getByLabelText("Duración (minutos)"), "45");
    await userEvent.type(screen.getByLabelText("Precio base"), "2500");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Service already exists"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Corte");
  });

  it("requests the next offset when clicking Next", async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      makeService({ id: `service_${index}`, name: `Servicio ${index}` }),
    );
    const fetchMock = stubFetch([
      { ok: true, data: firstPage },
      {
        ok: true,
        data: [makeService({ id: "service_10", name: "Servicio 10" })],
      },
    ]);

    renderServicesPage();

    await screen.findByText("Servicio 0");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await screen.findByText("Servicio 10");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/services?limit=10&offset=10",
      expect.any(Object),
    );
  });
});

function renderServicesPage() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ServicesCrudPage />
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

function makeService(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    id: "service_1",
    name: "Corte",
    description: "Corte clásico",
    durationMinutes: 45,
    basePrice: "2500.00",
    isActive: true,
    allowedRoles: ["BARBER"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
