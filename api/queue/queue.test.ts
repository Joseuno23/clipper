// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { QueueTicketRecord } from "../../src/server/domain/queue/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const queueRepository = {
  listLiveQueues: vi.fn(),
  findActiveClient: vi.fn(),
  findActiveStaff: vi.fn(),
  findActiveService: vi.fn(),
  findActiveServices: vi.fn(),
  createWalkIn: vi.fn(),
  createScheduledAppointment: vi.fn(),
  updateTicket: vi.fn(),
  cancelTicket: vi.fn(),
};

vi.mock("../../src/server/api/auth", () => ({
  getAuthContext,
  requireAdminCapable,
}));

vi.mock("../../src/server/repositories/queueRepository", () => ({
  queueRepository,
}));

const authContext = {
  user: {
    id: "user_1",
    email: "admin@clipper.test",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    slug: "niche-72",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
  },
  membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
  tokenClaims: {
    sub: "user_1",
    barberShopId: "shop_1",
    barberShopSlug: "niche-72",
    role: "OWNER",
    membershipStatus: "ACTIVE",
    typ: "access",
  },
};

const now = new Date("2026-01-01T12:00:00.000Z");

function createTicket(overrides: Partial<QueueTicketRecord> = {}) {
  return {
    id: "appt_1",
    clientId: "client_1",
    staffMemberId: "staff_1",
    status: "CHECKED_IN",
    source: "WALK_IN",
    startAt: now,
    endAt: new Date("2026-01-01T12:45:00.000Z"),
    queueStatus: "WAITING",
    queuedAt: now,
    queuePosition: 1,
    checkedInAt: now,
    createdAt: now,
    updatedAt: now,
    client: { id: "client_1", firstName: "Ada", lastName: "Lovelace" },
    services: [
      {
        id: "appt_service_1",
        serviceId: "service_1",
        serviceNameSnapshot: "Classic Cut",
        servicePriceSnapshot: { toString: () => "1500.00" },
        serviceDurationSnapshot: 45,
        sortOrder: 0,
      },
    ],
    ...overrides,
  } satisfies QueueTicketRecord;
}

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(status: number) {
      this.statusCode = status;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as VercelResponse & typeof response;
}

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    ...overrides,
  } as VercelRequest;
}

describe("queue API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    queueRepository.listLiveQueues.mockReset().mockResolvedValue([]);
    queueRepository.findActiveClient
      .mockReset()
      .mockResolvedValue({ id: "client_1" });
    queueRepository.findActiveStaff
      .mockReset()
      .mockResolvedValue({ id: "staff_1" });
    queueRepository.findActiveService.mockReset().mockResolvedValue({
      id: "service_1",
      name: "Classic Cut",
      durationMinutes: 45,
      price: { toString: () => "1500.00" },
    });
    const activeServices = [
      {
        id: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: { toString: () => "1500.00" },
      },
      {
        id: "service_2",
        name: "Beard Trim",
        durationMinutes: 20,
        price: { toString: () => "900.00" },
      },
    ];
    queueRepository.findActiveServices
      .mockReset()
      .mockImplementation(async ({ serviceIds }) =>
        activeServices.filter((service) => serviceIds.includes(service.id)),
      );
    queueRepository.createWalkIn.mockReset().mockResolvedValue(createTicket());
    queueRepository.createScheduledAppointment
      .mockReset()
      .mockResolvedValue(createTicket({ source: "PHONE" }));
    queueRepository.updateTicket.mockReset().mockResolvedValue(createTicket());
    queueRepository.cancelTicket.mockReset().mockResolvedValue(
      createTicket({
        status: "CANCELLED",
        queueStatus: "LEFT",
        queuePosition: null,
      }),
    );
  });

  it("lists live queues scoped from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(createRequest({ method: "GET" }), response);

    expect(queueRepository.listLiveQueues).toHaveBeenCalledWith({
      barberShopId: "shop_1",
    });
    expect(response.body).toEqual({ ok: true, data: { queues: [] } });
  });

  it("creates a walk-in with admin guard and selected entities", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          clientId: "client_1",
          serviceIds: ["service_1", "service_2"],
          staffMemberId: "staff_1",
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(queueRepository.createWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        data: {
          serviceIds: ["service_1", "service_2"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
        },
      }),
    );
  });

  it("keeps legacy serviceId payloads compatible", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          clientId: "client_1",
          serviceId: "service_1",
          staffMemberId: "staff_1",
        },
      }),
      response,
    );

    expect(queueRepository.createWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ serviceIds: ["service_1"] }),
      }),
    );
  });

  it("creates a walk-in with normalized new-client data", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          serviceIds: ["service_1"],
          staffMemberId: "staff_1",
          client: {
            kind: "new",
            firstName: " Ada ",
            lastName: " Lovelace ",
            phone: "11 5555-4444",
            documentNumber: "20-123.456",
          },
        },
      }),
      response,
    );

    expect(queueRepository.findActiveClient).not.toHaveBeenCalled();
    expect(queueRepository.createWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          client: {
            kind: "new",
            firstName: "Ada",
            lastName: "Lovelace",
            phone: "11 5555-4444",
            normalizedPhone: "1155554444",
            documentNumber: "20-123.456",
            normalizedDocument: "20123456",
          },
        }),
      }),
    );
  });

  it("creates a scheduled appointment through appointments API", async () => {
    const { default: handler } = await import("../appointments/index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          clientId: "client_1",
          serviceIds: ["service_1", "service_2"],
          staffMemberId: "staff_1",
          startAt: "2026-01-01T15:00:00.000Z",
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(queueRepository.createScheduledAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        data: expect.objectContaining({
          serviceIds: ["service_1", "service_2"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
          startAt: new Date("2026-01-01T15:00:00.000Z"),
        }),
      }),
    );
  });

  it("moves a ticket through the patch handler", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { staffMemberId: "staff_2" },
      }),
      response,
    );

    expect(queueRepository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });
  });

  it("passes queue position actions through the patch handler", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { positionAction: "UP" },
      }),
      response,
    );

    expect(queueRepository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { positionAction: "UP" },
    });
  });

  it("passes promote-to-chair actions through the patch handler", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { positionAction: "CHAIR" },
      }),
      response,
    );

    expect(queueRepository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { positionAction: "CHAIR" },
    });
  });

  it("patches ticket client and replacement services", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { clientId: "client_1", serviceIds: ["service_1", "service_2"] },
      }),
      response,
    );

    expect(queueRepository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { clientId: "client_1", serviceIds: ["service_1", "service_2"] },
      services: [
        expect.objectContaining({ id: "service_1" }),
        expect.objectContaining({ id: "service_2" }),
      ],
    });
  });

  it("rejects empty replacement services before patching", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { serviceIds: [] },
      }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(queueRepository.updateTicket).not.toHaveBeenCalled();
  });

  it("rejects non-live queue statuses before patching", async () => {
    const { default: handler } = await import("./[id]");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "appt_1" },
        body: { queueStatus: "NOT_QUEUED" },
      }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "BAD_REQUEST" }),
      }),
    );
    expect(queueRepository.updateTicket).not.toHaveBeenCalled();
  });

  it("routes POST /api/queue/:id/cancel and requires a cancellation reason", async () => {
    const { getApiRoute } = await import("../../vite.config");
    const apiRoute = getApiRoute("/api/queue/appt_1/cancel");

    expect(apiRoute).toEqual({
      modulePath: expect.stringContaining("api/queue/[id]/cancel.ts"),
      params: { id: "appt_1" },
    });

    const { default: cancelHandler } = await import("./[id]/cancel");
    const emptyReasonResponse = createResponse();

    await cancelHandler(
      createRequest({
        method: "POST",
        query: apiRoute!.params,
        body: { reason: "" },
      }),
      emptyReasonResponse,
    );

    expect(emptyReasonResponse.statusCode).toBe(400);
    expect(queueRepository.cancelTicket).not.toHaveBeenCalled();

    const cancelResponse = createResponse();
    await cancelHandler(
      createRequest({
        method: "POST",
        query: apiRoute!.params,
        body: { reason: "Cliente canceló" },
      }),
      cancelResponse,
    );

    expect(queueRepository.cancelTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      reason: "Cliente canceló",
    });
    expect(cancelResponse.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        status: "CANCELLED",
        queueStatus: "LEFT",
        queuePosition: null,
      }),
    });
  });
});
