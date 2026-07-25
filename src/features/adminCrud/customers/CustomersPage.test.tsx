import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { CustomerDto } from "@/shared/api/adminCrud";

import { CustomersCrudPage } from "./CustomersPage";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("CustomersCrudPage", () => {
  it("shows a loading state while customer rows are pending", () => {
    const fetchMock = vi.fn(() => new Promise<Response>(() => undefined));
    vi.stubGlobal("fetch", fetchMock);

    renderCustomersPage();

    expect(screen.getByText("Cargando clientes")).toBeInTheDocument();
  });

  it("shows an actionable error state when loading customers fails", async () => {
    stubFetch([
      {
        ok: false,
        error: { code: "SERVER_ERROR", message: "No se pudo listar" },
        status: 500,
      },
    ]);

    renderCustomersPage();

    expect(
      await screen.findByText("No se pudieron cargar los clientes"),
    ).toBeInTheDocument();
    expect(screen.getByText("No se pudo listar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeEnabled();
  });

  it("renders customer rows from the API", async () => {
    stubFetch([
      { ok: true, data: [makeCustomer({ firstName: "Ana", lastName: "Paz" })] },
    ]);

    renderCustomersPage();

    expect(await screen.findByText("Ana Paz")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("requests the next offset when clicking Next", async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      makeCustomer({ id: `client_${index}`, firstName: `Cliente ${index}` }),
    );
    const fetchMock = stubFetch([
      { ok: true, data: firstPage },
      {
        ok: true,
        data: [makeCustomer({ id: "client_10", firstName: "Cliente 10" })],
      },
    ]);

    renderCustomersPage();

    await screen.findByText("Cliente 0 Test");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await screen.findByText("Cliente 10 Test");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/clients?limit=10&offset=10",
      expect.any(Object),
    );
  });

  it("keeps entered form values visible when create fails", async () => {
    stubFetch([
      { ok: true, data: [] },
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "El email ya existe" },
        status: 422,
      },
    ]);
    renderCustomersPage();

    await screen.findByText("Todavía no hay clientes");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo cliente" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Ana");
    await userEvent.type(screen.getByLabelText("Apellido"), "Paz");
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("El email ya existe")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("refreshes the visible customer row after creating a customer", async () => {
    const fetchMock = stubFetch([
      { ok: true, data: [] },
      {
        ok: true,
        data: makeCustomer({ firstName: "Bruno", lastName: "López" }),
      },
      {
        ok: true,
        data: [makeCustomer({ firstName: "Bruno", lastName: "López" })],
      },
    ]);
    renderCustomersPage();

    await screen.findByText("Todavía no hay clientes");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo cliente" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Bruno");
    await userEvent.type(screen.getByLabelText("Apellido"), "López");
    await userEvent.type(screen.getByLabelText("Email"), "bruno@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Bruno López")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          firstName: "Bruno",
          lastName: "López",
          email: "bruno@example.com",
          phone: null,
          documentNumber: null,
          notes: null,
          isBlocked: false,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/clients?limit=10&offset=0",
      expect.any(Object),
    );
  });

  it("refreshes the visible customer row after editing a customer", async () => {
    const fetchMock = stubFetch([
      {
        ok: true,
        data: [makeCustomer({ firstName: "Ana", lastName: "Paz" })],
      },
      {
        ok: true,
        data: makeCustomer({ firstName: "Ana", lastName: "García" }),
      },
      {
        ok: true,
        data: [makeCustomer({ firstName: "Ana", lastName: "García" })],
      },
    ]);
    renderCustomersPage();

    await screen.findByText("Ana Paz");
    await userEvent.click(screen.getByRole("button", { name: "Editar" }));
    await userEvent.clear(screen.getByLabelText("Apellido"));
    await userEvent.type(screen.getByLabelText("Apellido"), "García");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Ana García")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients/client_1",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("refreshes the visible customer rows after deleting a customer", async () => {
    const fetchMock = stubFetch([
      {
        ok: true,
        data: [makeCustomer({ firstName: "Ana", lastName: "Paz" })],
      },
      { ok: true, data: null },
      { ok: true, data: [] },
    ]);
    renderCustomersPage();

    await screen.findByText("Ana Paz");
    await userEvent.click(screen.getByRole("button", { name: "Eliminar" }));
    const dialog = screen.getByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Eliminar" }),
    );

    await waitFor(() =>
      expect(screen.queryByText("Ana Paz")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText("Todavía no hay clientes"),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients/client_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});

function renderCustomersPage() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CustomersCrudPage />
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

function makeCustomer(overrides: Partial<CustomerDto> = {}): CustomerDto {
  return {
    id: "client_1",
    firstName: "Ana",
    lastName: "Test",
    email: "ana@example.com",
    phone: "555-0000",
    documentNumber: "123",
    notes: null,
    isBlocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
