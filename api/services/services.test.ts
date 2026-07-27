// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ServiceRecord } from "../../src/server/domain/services/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const serviceRepository = {
  list: vi.fn(),
  create: vi.fn(),
  findActiveById: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
};

vi.mock("../../src/server/api/auth", () => ({
  getAuthContext,
  requireAdminCapable,
}));

vi.mock("../../src/server/repositories/serviceRepository", () => ({
  serviceRepository,
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

const now = new Date("2026-01-01T00:00:00.000Z");

function createRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: "service_1",
    barberShopId: "shop_1",
    name: "Classic Cut",
    description: null,
    durationMinutes: 45,
    price: { toString: () => "1500.00" },
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    allowedRoles: [
      {
        id: "allowed_role_1",
        serviceId: "service_1",
        barberShopId: "shop_1",
        role: "BARBER",
        staffMemberId: null,
        createdAt: now,
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

describe("services API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    serviceRepository.list.mockReset().mockResolvedValue([createRecord()]);
    serviceRepository.create.mockReset().mockResolvedValue(createRecord());
    serviceRepository.findActiveById
      .mockReset()
      .mockResolvedValue(createRecord());
    serviceRepository.update
      .mockReset()
      .mockResolvedValue(createRecord({ durationMinutes: 60 }));
    serviceRepository.softDelete
      .mockReset()
      .mockResolvedValue(createRecord({ deletedAt: now, isActive: false }));
  });

  it("lists services scoped from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { limit: "10", query: "Cut" } }),
      response,
    );

    expect(serviceRepository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 10, offset: 0, query: "Cut" },
    });
    expect(response.body).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: "service_1" })],
    });
  });

  it("creates services with admin guard and normalized payload", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          name: " Classic   Cut ",
          durationMinutes: "45",
          basePrice: "1500",
          allowedRoles: ["BARBER"],
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(serviceRepository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({
        name: "Classic Cut",
        basePrice: "1500.00",
        allowedRoles: ["BARBER"],
      }),
    });
    expect(response.statusCode).toBe(200);
  });

  it("gets, updates, and deletes services by path id", async () => {
    const { default: handler } = await import("./[id]");

    const getResponse = createResponse();
    await handler(
      createRequest({ method: "GET", query: { id: "service_1" } }),
      getResponse,
    );
    expect(serviceRepository.findActiveById).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "service_1",
    });

    const patchResponse = createResponse();
    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "service_1" },
        body: { durationMinutes: "60", allowedRoles: ["MANAGER"] },
      }),
      patchResponse,
    );
    expect(serviceRepository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "service_1",
      data: { durationMinutes: 60, allowedRoles: ["MANAGER"] },
    });

    const deleteResponse = createResponse();
    await handler(
      createRequest({ method: "DELETE", query: { id: "service_1" } }),
      deleteResponse,
    );
    expect(serviceRepository.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1", id: "service_1" }),
    );
  });

  it("returns a safe forbidden envelope when admin guard rejects mutation", async () => {
    const { ApiError } = await import("../../src/server/api/errors");

    requireAdminCapable.mockImplementationOnce(() => {
      throw new ApiError({
        code: "FORBIDDEN",
        message: "Admin access is required.",
      });
    });
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: { name: "Cut", durationMinutes: 45, basePrice: "1500.00" },
      }),
      response,
    );

    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Admin access is required.",
      },
    });
  });
});
