// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StaffRecord } from "../../src/server/domain/staff/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const staffRepository = {
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

vi.mock("../../src/server/repositories/staffRepository", () => ({
  staffRepository,
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
const photoDataUrl = "data:image/png;base64,aGVsbG8=";

function createRecord(overrides: Partial<StaffRecord> = {}): StaffRecord {
  return {
    id: "staff_1",
    barberShopId: "shop_1",
    userId: null,
    firstName: "Ada",
    lastName: "Lovelace",
    displayName: "Ada L.",
    email: "ada@clipper.test",
    normalizedEmail: "ada@clipper.test",
    phone: null,
    normalizedPhone: null,
    photoDataUrl: null,
    isActive: true,
    commissionMode: "NONE",
    commissionValue: { toString: () => "0.00" },
    workingDays: [],
    restDays: [],
    specialties: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    roles: [
      {
        id: "role_1",
        staffMemberId: "staff_1",
        barberShopId: "shop_1",
        role: "BARBER",
        createdAt: now,
      },
    ],
    serviceCommissions: [
      {
        id: "commission_1",
        staffMemberId: "staff_1",
        serviceId: "service_1",
        barberShopId: "shop_1",
        commissionMode: "PERCENTAGE_BPS",
        commissionValue: { toString: () => "1500.00" },
        createdAt: now,
        updatedAt: now,
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

describe("staff API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    staffRepository.list.mockReset().mockResolvedValue([createRecord()]);
    staffRepository.create.mockReset().mockResolvedValue(createRecord());
    staffRepository.findActiveById
      .mockReset()
      .mockResolvedValue(createRecord());
    staffRepository.update
      .mockReset()
      .mockResolvedValue(createRecord({ displayName: "Ada Updated" }));
    staffRepository.softDelete
      .mockReset()
      .mockResolvedValue(createRecord({ deletedAt: now, isActive: false }));
  });

  it("lists staff scoped from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { limit: "10" } }),
      response,
    );

    expect(staffRepository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 10, offset: 0 },
    });
    expect(response.body).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: "staff_1" })],
    });
  });

  it("creates staff with admin guard and normalized payload", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          firstName: " Ada ",
          lastName: " Lovelace ",
          displayName: " Ada   L. ",
          email: "ADA@CLIPPER.TEST",
          photoDataUrl,
          roles: ["BARBER"],
          serviceCommissions: [
            {
              serviceId: "service_1",
              commissionMode: "PERCENTAGE_BPS",
              commissionValue: "1500",
            },
          ],
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(staffRepository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada L.",
        normalizedEmail: "ada@clipper.test",
        photoDataUrl,
        roles: ["BARBER"],
        serviceCommissions: [
          {
            serviceId: "service_1",
            commissionMode: "PERCENTAGE_BPS",
            commissionValue: "1500.00",
          },
        ],
      }),
    });
    expect(response.statusCode).toBe(200);
  });

  it("gets, updates, and deletes staff by path id", async () => {
    const { default: handler } = await import("./[id]");

    const getResponse = createResponse();
    await handler(
      createRequest({ method: "GET", query: { id: "staff_1" } }),
      getResponse,
    );
    expect(staffRepository.findActiveById).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "staff_1",
    });

    const patchResponse = createResponse();
    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "staff_1" },
        body: {
          displayName: " Ada Updated ",
          photoDataUrl: null,
          roles: ["MANAGER"],
          serviceCommissions: [],
        },
      }),
      patchResponse,
    );
    expect(staffRepository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "staff_1",
      data: {
        displayName: "Ada Updated",
        photoDataUrl: null,
        roles: ["MANAGER"],
        serviceCommissions: [],
      },
    });

    const deleteResponse = createResponse();
    await handler(
      createRequest({ method: "DELETE", query: { id: "staff_1" } }),
      deleteResponse,
    );
    expect(staffRepository.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1", id: "staff_1" }),
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
        body: { firstName: "Ada", lastName: "Lovelace", displayName: "Ada" },
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
