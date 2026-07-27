import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { CustomerDto, ServiceDto, StaffDto } from "@/shared/api/adminCrud";
import type { LiveQueuesDto, QueueTicketDto } from "@/shared/api/queue";

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");

  function Select({
    value,
    disabled,
    onValueChange,
    children,
  }: {
    value?: string;
    disabled?: boolean;
    onValueChange?: (value: string) => void;
    children: React.ReactNode;
  }) {
    const id = findProp<string>(children, "id");
    const placeholder = findProp<string>(children, "placeholder");
    const items = findItems(children);

    return React.createElement(
      "select",
      {
        id,
        value: value ?? "",
        disabled,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) =>
          onValueChange?.(event.target.value),
      },
      React.createElement("option", { value: "", disabled: true }, placeholder),
      ...items.map((item) =>
        React.createElement(
          "option",
          { key: item.value, value: item.value },
          item.label,
        ),
      ),
    );
  }

  function SelectTrigger({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  function SelectValue({ placeholder }: { placeholder?: string }) {
    return React.createElement(React.Fragment, null, placeholder);
  }

  function SelectContent({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  function SelectItem({ children }: { children: React.ReactNode }) {
    return React.createElement(React.Fragment, null, children);
  }

  function findProp<T>(
    children: React.ReactNode,
    propName: string,
  ): T | undefined {
    let result: T | undefined;

    React.Children.forEach(children, (child) => {
      if (result !== undefined || !React.isValidElement(child)) return;

      const props = child.props as Record<string, unknown>;
      if (props[propName] !== undefined) {
        result = props[propName] as T;
        return;
      }

      result = findProp<T>(props["children"] as React.ReactNode, propName);
    });

    return result;
  }

  function findItems(
    children: React.ReactNode,
  ): Array<{ value: string; label: string }> {
    const items: Array<{ value: string; label: string }> = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;

      const props = child.props as Record<string, unknown>;
      if (props["value"] !== undefined) {
        items.push({
          value: String(props["value"]),
          label: String(props["children"] ?? ""),
        });
      }

      items.push(...findItems(props["children"] as React.ReactNode));
    });

    return items;
  }

  return { Select, SelectContent, SelectItem, SelectTrigger, SelectValue };
});

import { QueueDisplayView, QueueView } from "./QueueView";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("QueueView new walk-in client search", () => {
  it("does not render every service by default", async () => {
    const fetchMock = stubQueueFetch({
      services: [
        makeService({ id: "service_cut", name: "Corte" }),
        makeService({ id: "service_beard", name: "Barba" }),
      ],
    });

    renderQueueView();
    await openNewTurnDialog();

    expect(screen.getByText("Servicios del turno")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Agregar servicio" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Corte")).not.toBeInTheDocument();
    expect(screen.queryByText("Barba")).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/services(?:\?|$)/),
      expect.any(Object),
    );
  });

  it("opens service search from the add-service CTA", async () => {
    stubQueueFetch();

    renderQueueView();
    await openNewTurnDialog();

    await userEvent.click(
      screen.getByRole("button", { name: "+ Agregar servicio" }),
    );

    expect(screen.getByLabelText("Buscar servicio")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Escribí al menos 2 caracteres para buscar sin cargar toda la lista.",
      ),
    ).toBeInTheDocument();
  });

  it("searches services from the server only after the query threshold", async () => {
    const fetchMock = stubQueueFetch({
      services: [makeService({ id: "service_cut", name: "Corte" })],
    });

    renderQueueView();
    await openNewTurnDialog();
    await userEvent.click(
      screen.getByRole("button", { name: "+ Agregar servicio" }),
    );

    await userEvent.type(screen.getByLabelText("Buscar servicio"), "C");
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/services/),
      expect.any(Object),
    );

    await userEvent.type(screen.getByLabelText("Buscar servicio"), "o");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/services?limit=8&offset=0&query=Co",
        expect.any(Object),
      ),
    );
    expect(await screen.findByText("Corte")).toBeInTheDocument();
  });

  it("opens without preloading a large client select", async () => {
    const fetchMock = stubQueueFetch();

    renderQueueView();
    await screen.findByText("No hay staff activo para mostrar");
    await userEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));

    expect(screen.getByLabelText("Cliente")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/clients(?:\?|$)/),
      expect.any(Object),
    );
  });

  it("searches clients only after numeric or text thresholds are met", async () => {
    const fetchMock = stubQueueFetch();

    renderQueueView();
    await openNewTurnDialog();

    const clientInput = screen.getByLabelText("Cliente");
    await userEvent.type(clientInput, "123");

    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringMatching(/^\/api\/clients/),
      expect.any(Object),
    );

    await userEvent.type(clientInput, "4");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients?limit=10&offset=0&query=1234",
        expect.any(Object),
      ),
    );

    await userEvent.clear(clientInput);
    await userEvent.type(clientInput, "ab");

    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/clients?limit=10&offset=0&query=ab",
      expect.any(Object),
    );

    await userEvent.type(clientInput, "a");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/clients?limit=10&offset=0&query=aba",
        expect.any(Object),
      ),
    );
  });

  it("submits the existing-client payload after selecting a suggested client", async () => {
    const existingCustomer = makeCustomer({
      id: "client_existing",
      firstName: "Ada",
      lastName: "Lovelace",
      documentNumber: "20.123.456",
      normalizedDocument: "20123456",
    });
    const fetchMock = stubQueueFetch({ clients: [existingCustomer] });

    renderQueueView();
    await openNewTurnDialog();

    await userEvent.type(screen.getByLabelText("Cliente"), "20123456");
    await userEvent.click(await screen.findByText("Ada Lovelace"));
    await addService("Corte clásico");
    await selectOption("Staff preferido", "Ana Barber");
    await userEvent.click(screen.getByRole("button", { name: "Crear turno" }));

    await waitFor(() => expect(findQueuePost(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePost(fetchMock)?.body))).toEqual({
      serviceIds: ["service_1"],
      staffMemberId: "staff_1",
      client: { kind: "existing", clientId: "client_existing" },
    });
  });

  it("submits all selected service ids", async () => {
    const existingCustomer = makeCustomer({ id: "client_existing" });
    const fetchMock = stubQueueFetch({
      clients: [existingCustomer],
      services: [
        makeService({ id: "service_cut", name: "Corte" }),
        makeService({
          id: "service_beard",
          name: "Barba",
          durationMinutes: 20,
        }),
      ],
    });

    renderQueueView();
    await openNewTurnDialog();

    await userEvent.type(screen.getByLabelText("Cliente"), "20123456");
    await userEvent.click(await screen.findByText("Ana Paz"));
    await addService("Corte");
    await addService("Barba");
    expect(screen.getByLabelText("Servicios seleccionados")).toHaveTextContent(
      "Corte",
    );
    expect(screen.getByLabelText("Servicios seleccionados")).toHaveTextContent(
      "Barba",
    );
    await selectOption("Staff preferido", "Ana Barber");
    await userEvent.click(screen.getByRole("button", { name: "Crear turno" }));

    await waitFor(() => expect(findQueuePost(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePost(fetchMock)?.body))).toEqual(
      expect.objectContaining({ serviceIds: ["service_cut", "service_beard"] }),
    );
  });

  it("prevents duplicate services and allows removing a selected service", async () => {
    stubQueueFetch({
      services: [makeService({ id: "service_cut", name: "Corte" })],
    });

    renderQueueView();
    await openNewTurnDialog();

    expect(screen.getByRole("button", { name: "Crear turno" })).toBeDisabled();
    await addService("Corte");
    expect(screen.getByRole("button", { name: "Crear turno" })).toBeEnabled();

    await userEvent.click(
      screen.getByRole("button", { name: "+ Agregar servicio" }),
    );
    await userEvent.type(screen.getByLabelText("Buscar servicio"), "Corte");
    expect(
      await screen.findByText("Sin coincidencias disponibles."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Servicios seleccionados")).toHaveTextContent(
      "Corte",
    );

    await userEvent.click(screen.getByRole("button", { name: "Quitar Corte" }));
    expect(
      screen.queryByLabelText("Servicios seleccionados"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Crear turno" })).toBeDisabled();
  });

  it("shows new-client fields only for unmatched document-like input", async () => {
    stubQueueFetch();

    renderQueueView();
    await openNewTurnDialog();

    await userEvent.type(screen.getByLabelText("Cliente"), "20123456");

    expect(await screen.findByLabelText("Nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Apellido")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Cliente"));
    await userEvent.type(screen.getByLabelText("Cliente"), "+54 11 5555 4444");

    await waitFor(() =>
      expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument(),
    );
  });

  it("hides blocked clients from queue suggestions", async () => {
    stubQueueFetch({
      clients: [
        makeCustomer({ firstName: "Visible", lastName: "Client" }),
        makeCustomer({
          id: "client_blocked",
          firstName: "Blocked",
          lastName: "Client",
          isBlocked: true,
        }),
      ],
    });

    renderQueueView();
    await openNewTurnDialog();

    await userEvent.type(screen.getByLabelText("Cliente"), "Client");

    expect(await screen.findByText("Visible Client")).toBeInTheDocument();
    expect(screen.queryByText("Blocked Client")).not.toBeInTheDocument();
  });
});

describe("QueueView ticket editing", () => {
  it("shows the in-service client name visibly on the chair", async () => {
    stubQueueFetch({
      queue: makeLiveQueue({
        tickets: [makeQueueTicket({ queueStatus: "IN_SERVICE" })],
      }),
    });

    renderQueueView();

    expect(await screen.findByText("Ana Paz")).toBeInTheDocument();
    expect(screen.getByTitle("Editar turno · Ana Paz")).toBeInTheDocument();
  });

  it("opens an edit dialog from a waiting ticket with current client and services", async () => {
    stubQueueFetch({
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();
    await userEvent.click(
      await screen.findByLabelText("Editar turno de Ana Paz"),
    );

    expect(await screen.findByRole("dialog")).toHaveTextContent("Editar turno");
    expect(screen.getByDisplayValue("Ana Paz")).toBeInTheDocument();
    expect(screen.getByLabelText("Servicios seleccionados")).toHaveTextContent(
      "Corte clásico",
    );
  });

  it("changing the selected client sends a PATCH", async () => {
    const fetchMock = stubQueueFetch({
      clients: [
        makeCustomer({
          id: "client_2",
          firstName: "Bruno",
          lastName: "Díaz",
        }),
      ],
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();
    await userEvent.click(
      await screen.findByLabelText("Editar turno de Ana Paz"),
    );
    await userEvent.clear(screen.getByLabelText("Cliente"));
    await userEvent.type(screen.getByLabelText("Cliente"), "Bruno");
    await userEvent.click(await screen.findByText("Bruno Díaz"));
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar cambios" }),
    );

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      clientId: "client_2",
      serviceIds: ["service_1"],
    });
  });

  it("adding and removing services sends the replacement serviceIds", async () => {
    const fetchMock = stubQueueFetch({
      services: [makeService({ id: "service_beard", name: "Barba" })],
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();
    await userEvent.click(
      await screen.findByLabelText("Editar turno de Ana Paz"),
    );
    await addService("Barba");
    await userEvent.click(
      screen.getByRole("button", { name: "Quitar Corte clásico" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar cambios" }),
    );

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      clientId: "client_1",
      serviceIds: ["service_beard"],
    });
  });

  it("sends a PATCH when a waiting ticket is reordered", async () => {
    const fetchMock = stubQueueFetch({
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();

    await userEvent.click(
      await screen.findByLabelText("Bajar turno de Ana Paz"),
    );

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      positionAction: "DOWN",
    });
  });

  it("sends a PATCH when a waiting ticket is promoted to the chair", async () => {
    const fetchMock = stubQueueFetch({
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();

    await userEvent.click(
      await screen.findByRole("button", { name: "Pasar a silla" }),
    );

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      positionAction: "CHAIR",
    });
  });

  it("sends a PATCH when a waiting ticket is moved to another staff member", async () => {
    const fetchMock = stubQueueFetch({
      staff: [
        makeStaff(),
        makeStaff({ id: "staff_2", displayName: "Bruno Barber" }),
      ],
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();
    await screen.findByText("Ana Paz · Corte clásico");

    await userEvent.selectOptions(screen.getByRole("combobox"), "staff_2");

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      staffMemberId: "staff_2",
    });
  });

  it("exposes operational move and reorder controls in the admin view", async () => {
    stubQueueFetch({
      staff: [
        makeStaff(),
        makeStaff({ id: "staff_2", displayName: "Bruno Barber" }),
      ],
      queue: makeLiveQueue({ tickets: [makeQueueTicket()] }),
    });

    renderQueueView();

    expect(
      await screen.findByText("Ana Paz · Corte clásico"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Bajar turno de Ana Paz" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent("Ana Barber");
  });

  it("sends a PATCH when an in-service ticket is moved to another staff member", async () => {
    const fetchMock = stubQueueFetch({
      staff: [
        makeStaff(),
        makeStaff({ id: "staff_2", displayName: "Bruno Barber" }),
      ],
      queue: makeLiveQueue({
        tickets: [makeQueueTicket({ queueStatus: "IN_SERVICE" })],
      }),
    });

    renderQueueView();
    await screen.findByTitle("Editar turno · Ana Paz");

    await userEvent.selectOptions(screen.getByRole("combobox"), "staff_2");

    await waitFor(() => expect(findQueuePatch(fetchMock)).toBeDefined());
    expect(JSON.parse(String(findQueuePatch(fetchMock)?.body))).toEqual({
      staffMemberId: "staff_2",
    });
  });
});

describe("QueueDisplayView", () => {
  it("renders staff queues with names and positions without admin controls", async () => {
    stubQueueFetch({
      queue: makeLiveQueue({
        tickets: [
          makeQueueTicket({ queueStatus: "IN_SERVICE", queuePosition: 1 }),
          makeQueueTicket({
            id: "ticket_2",
            clientName: "Bruno Díaz",
            queuePosition: 2,
          }),
        ],
      }),
    });

    renderQueueDisplayView();

    expect(await screen.findByText("Ana Barber")).toBeInTheDocument();
    expect(screen.getByText("Ana Paz")).toBeInTheDocument();
    expect(screen.getByText("Bruno Díaz")).toBeInTheDocument();
    expect(screen.getByText("Posición 2")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByText("Nuevo turno")).not.toBeInTheDocument();
  });

  it("polls the live queue for TV refresh", async () => {
    vi.useFakeTimers();
    const fetchMock = stubQueueFetch();

    renderQueueDisplayView({ refetchIntervalMs: 10 });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });

    expect(fetchMock).toHaveBeenCalledWith("/api/queue", expect.any(Object));
  });
});

function renderQueueDisplayView({
  refetchIntervalMs,
}: { refetchIntervalMs?: number } = {}) {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <QueueDisplayView refetchIntervalMs={refetchIntervalMs} />
    </QueryClientProvider>,
  );
}

function renderQueueView() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <QueueView />
    </QueryClientProvider>,
  );
}

async function openNewTurnDialog() {
  await screen.findByText("No hay staff activo para mostrar");
  await userEvent.click(screen.getByRole("button", { name: "Nuevo turno" }));
  return screen.findByRole("dialog");
}

async function selectOption(label: string, option: string) {
  await userEvent.selectOptions(screen.getByLabelText(label), option);
}

async function addService(serviceName: string) {
  await userEvent.click(
    screen.getByRole("button", { name: "+ Agregar servicio" }),
  );
  await userEvent.type(screen.getByLabelText("Buscar servicio"), serviceName);
  await userEvent.click(await screen.findByText(serviceName));
}

type QueueFetchOptions = {
  clients?: CustomerDto[];
  services?: ServiceDto[];
  staff?: StaffDto[];
  queue?: LiveQueuesDto;
  createdTicket?: QueueTicketDto;
};

function stubQueueFetch({
  clients = [],
  services = [makeService()],
  staff = [makeStaff()],
  queue = { queues: [] },
  createdTicket = makeQueueTicket(),
}: QueueFetchOptions = {}) {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";

    if (url.startsWith("/api/queue") && method === "GET") {
      return ok(queue);
    }

    if (url === "/api/queue" && method === "POST") {
      return ok(createdTicket);
    }

    if (url.startsWith("/api/queue/") && method === "PATCH") {
      return ok(createdTicket);
    }

    if (url.startsWith("/api/services")) {
      return ok(services);
    }

    if (url.startsWith("/api/staff")) {
      return ok(staff);
    }

    if (url.startsWith("/api/clients")) {
      return ok(clients);
    }

    throw new Error(`Unexpected fetch call: ${method} ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function findQueuePost(fetchMock: ReturnType<typeof stubQueueFetch>) {
  return fetchMock.mock.calls.find(
    ([url, init]) => url === "/api/queue" && init?.method === "POST",
  )?.[1];
}

function findQueuePatch(fetchMock: ReturnType<typeof stubQueueFetch>) {
  return fetchMock.mock.calls.find(
    ([url, init]) =>
      String(url).startsWith("/api/queue/") && init?.method === "PATCH",
  )?.[1];
}

function ok(data: unknown) {
  return Promise.resolve(Response.json({ ok: true, data }));
}

function makeCustomer(overrides: Partial<CustomerDto> = {}): CustomerDto {
  return {
    id: "client_1",
    firstName: "Ana",
    lastName: "Paz",
    email: null,
    phone: "11 5555-4444",
    normalizedPhone: "1155554444",
    documentNumber: "20.123.456",
    normalizedDocument: "20123456",
    notes: null,
    isBlocked: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeService(overrides: Partial<ServiceDto> = {}): ServiceDto {
  return {
    id: "service_1",
    name: "Corte clásico",
    description: null,
    durationMinutes: 45,
    basePrice: "2500.00",
    isActive: true,
    allowedRoles: ["BARBER"],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeStaff(overrides: Partial<StaffDto> = {}): StaffDto {
  return {
    id: "staff_1",
    userId: null,
    firstName: "Ana",
    lastName: "Barber",
    displayName: "Ana Barber",
    email: null,
    phone: null,
    isActive: true,
    commissionMode: "NONE",
    commissionValue: "0.00",
    workingDays: [1, 2, 3, 4, 5],
    restDays: [],
    roles: ["BARBER"],
    specialties: [],
    serviceCommissions: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeQueueTicket(
  overrides: Partial<QueueTicketDto> = {},
): QueueTicketDto {
  return {
    id: "ticket_1",
    clientId: "client_1",
    clientName: "Ana Paz",
    staffMemberId: "staff_1",
    status: "CHECKED_IN",
    queueStatus: "WAITING",
    queuedAt: "2026-01-01T12:00:00.000Z",
    queuePosition: 1,
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

function makeLiveQueue({
  tickets = [],
}: {
  tickets?: QueueTicketDto[];
} = {}): LiveQueuesDto {
  return {
    queues: [
      {
        staffId: "staff_1",
        staffName: "Ana Barber",
        roles: ["BARBER"],
        specialties: [],
        inServiceCount: tickets.filter(
          (ticket) => ticket.queueStatus === "IN_SERVICE",
        ).length,
        waitingCount: tickets.filter(
          (ticket) => ticket.queueStatus !== "IN_SERVICE",
        ).length,
        totalActiveCount: tickets.length,
        tickets,
      },
    ],
  };
}
