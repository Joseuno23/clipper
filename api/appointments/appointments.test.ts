// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppointmentListItemRecord } from "../../src/server/domain/queue/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const queueRepository = {
  listLiveQueues: vi.fn(),
  listAppointmentsByDate: vi.fn(),
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
    timezone: "UTC",
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

const startAt = new Date("2026-01-01T14:00:00.000Z");

function createAppointment(
  overrides: Partial<AppointmentListItemRecord> = {},
): AppointmentListItemRecord {
  return {
    id: "appt_1",
    clientId: "client_1",
    staffMemberId: "staff_1",
    status: "SCHEDULED",
    source: "PHONE",
    startAt,
    endAt: new Date("2026-01-01T14:45:00.000Z"),
    queueStatus: "NOT_QUEUED",
    queuedAt: null,
    queuePosition: null,
    checkedInAt: null,
    createdAt: startAt,
    updatedAt: startAt,
    client: { id: "client_1", firstName: "Ada", lastName: "Lovelace" },
    staffMember: {
      displayName: "Grace Hopper",
      firstName: "Grace",
      lastName: "Hopper",
    },
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
  };
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

describe("appointments API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    queueRepository.listAppointmentsByDate
      .mockReset()
      .mockResolvedValue([createAppointment()]);
    queueRepository.findActiveClient
      .mockReset()
      .mockResolvedValue({ id: "client_1" });
    queueRepository.findActiveStaff
      .mockReset()
      .mockResolvedValue({ id: "staff_1" });
    queueRepository.findActiveServices.mockReset().mockResolvedValue([
      {
        id: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: { toString: () => "1500.00" },
      },
    ]);
    queueRepository.createScheduledAppointment
      .mockReset()
      .mockResolvedValue(createAppointment());
  });

  it("lists appointments by shop-local date with denormalized display fields", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { date: "2026-01-01" } }),
      response,
    );

    expect(queueRepository.listAppointmentsByDate).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      from: new Date("2026-01-01T00:00:00.000Z"),
      toExclusive: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(response.body).toEqual({
      ok: true,
      data: [
        expect.objectContaining({
          id: "appt_1",
          clientName: "Ada Lovelace",
          staffName: "Grace Hopper",
          serviceName: "Classic Cut",
        }),
      ],
    });
  });

  it("rejects invalid list dates before querying appointments", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { date: "01-01-2026" } }),
      response,
    );

    expect(queueRepository.listAppointmentsByDate).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "BAD_REQUEST" }),
      }),
    );
  });

  it("rejects impossible calendar dates before querying appointments", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { date: "2026-99-99" } }),
      response,
    );

    expect(queueRepository.listAppointmentsByDate).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        ok: false,
        error: expect.objectContaining({ code: "BAD_REQUEST" }),
      }),
    );
  });
});
