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
  createWalkIn: vi.fn(),
  updateTicket: vi.fn(),
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
    queueRepository.createWalkIn.mockReset().mockResolvedValue(createTicket());
    queueRepository.updateTicket.mockReset().mockResolvedValue(createTicket());
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
          serviceId: "service_1",
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
          clientId: "client_1",
          serviceId: "service_1",
          staffMemberId: "staff_1",
        },
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
});
