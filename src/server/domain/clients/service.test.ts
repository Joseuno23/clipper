// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import { createClientService } from "./service";
import { parseClientCreateInput, parseClientUpdateInput } from "./validation";
import type { ClientRecord, ClientRepository } from "./types";

const baseContext = {
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
} as const;

const now = new Date("2026-01-01T00:00:00.000Z");

function createRecord(overrides: Partial<ClientRecord> = {}): ClientRecord {
  return {
    id: "client_1",
    barberShopId: "shop_1",
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada@clipper.test",
    normalizedEmail: "ada@clipper.test",
    phone: "+54 11 5555-7777",
    normalizedPhone: "+541155557777",
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

function createRepository(): ClientRepository {
  return {
    list: vi.fn(async () => [createRecord()]),
    create: vi.fn(async ({ data, barberShopId }) =>
      createRecord({ barberShopId, ...data }),
    ),
    findActiveById: vi.fn(async () => createRecord()),
    update: vi.fn(async ({ data }) => createRecord(data)),
    softDelete: vi.fn(async ({ deletedAt }) => createRecord({ deletedAt })),
  };
}

describe("client service", () => {
  let repository: ClientRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("lists active clients scoped to the authenticated tenant", async () => {
    const service = createClientService(repository);

    await service.list(baseContext, { limit: 50, offset: 0, query: null });

    expect(repository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 50, offset: 0, query: null },
    });
  });

  it("normalizes create input and returns a safe DTO", async () => {
    const service = createClientService(repository);
    const data = parseClientCreateInput({
      firstName: " Ada ",
      lastName: " Lovelace ",
      email: " ADA@CLIPPER.TEST ",
      phone: "+54 11 5555-7777",
      documentNumber: "20-123.456",
    });

    const client = await service.create(baseContext, data);

    expect(repository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({
        email: "ada@clipper.test",
        normalizedDocument: "20123456",
      }),
    });
    expect(client).toEqual(
      expect.objectContaining({ createdAt: now.toISOString() }),
    );
    expect(client).not.toHaveProperty("barberShopId");
  });

  it("maps duplicate document writes to conflict", async () => {
    repository.create = vi.fn(async () => {
      throw { code: "P2002" };
    });
    const service = createClientService(repository);

    await expect(
      service.create(
        baseContext,
        parseClientCreateInput({ firstName: "Ada", lastName: "Lovelace" }),
      ),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Client already exists for this barber shop.",
      }),
    );
  });

  it("rejects non-admin mutations", async () => {
    const service = createClientService(repository);

    await expect(
      service.create(
        {
          ...baseContext,
          membership: { ...baseContext.membership, role: "STAFF" },
        },
        parseClientCreateInput({ firstName: "Ada", lastName: "Lovelace" }),
      ),
    ).rejects.toThrow(
      new ApiError({ code: "FORBIDDEN", message: "Admin access is required." }),
    );
  });

  it("updates and soft deletes active clients only", async () => {
    const service = createClientService(repository);

    await service.update(
      baseContext,
      "client_1",
      parseClientUpdateInput({ notes: " VIP " }),
    );
    await service.delete(baseContext, "client_1", now);

    expect(repository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "client_1",
      data: { notes: "VIP" },
    });
    expect(repository.softDelete).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "client_1",
      deletedAt: now,
    });
  });
});
