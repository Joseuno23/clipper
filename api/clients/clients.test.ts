// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ClientRecord } from "../../src/server/domain/clients/types";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();

const clientRepository = {
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

vi.mock("../../src/server/repositories/clientRepository", () => ({
  clientRepository,
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

function createRecord(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id: "client_1",
    barberShopId: "shop_1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@clipper.test",
    normalizedEmail: "ada@clipper.test",
    phone: null,
    normalizedPhone: null,
    documentNumber: "20-123.456",
    normalizedDocument: "20123456",
    notes: null,
    isBlocked: false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
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

describe("clients API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    requireAdminCapable.mockReset();
    clientRepository.list.mockReset().mockResolvedValue([createRecord()]);
    clientRepository.create.mockReset().mockResolvedValue(createRecord());
    clientRepository.findActiveById
      .mockReset()
      .mockResolvedValue(createRecord());
    clientRepository.update
      .mockReset()
      .mockResolvedValue(createRecord({ notes: "VIP" }));
    clientRepository.softDelete
      .mockReset()
      .mockResolvedValue(createRecord({ deletedAt: now }));
  });

  it("lists clients scoped from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "GET", query: { limit: "10" } }),
      response,
    );

    expect(clientRepository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 10, offset: 0 },
    });
    expect(response.body).toEqual({
      ok: true,
      data: [expect.objectContaining({ id: "client_1" })],
    });
  });

  it("creates clients with admin guard and normalized payload", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          firstName: " Ada ",
          lastName: " Lovelace ",
          documentNumber: "20-123.456",
        },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalledWith(authContext);
    expect(clientRepository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({ normalizedDocument: "20123456" }),
    });
    expect(response.statusCode).toBe(200);
  });

  it("gets, updates, and deletes clients by path id", async () => {
    const { default: handler } = await import("./[id]");

    const getResponse = createResponse();
    await handler(
      createRequest({ method: "GET", query: { id: "client_1" } }),
      getResponse,
    );
    expect(clientRepository.findActiveById).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "client_1",
    });

    const patchResponse = createResponse();
    await handler(
      createRequest({
        method: "PATCH",
        query: { id: "client_1" },
        body: { notes: " VIP " },
      }),
      patchResponse,
    );
    expect(clientRepository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "client_1",
      data: { notes: "VIP" },
    });

    const deleteResponse = createResponse();
    await handler(
      createRequest({ method: "DELETE", query: { id: "client_1" } }),
      deleteResponse,
    );
    expect(clientRepository.softDelete).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1", id: "client_1" }),
    );
  });
});
