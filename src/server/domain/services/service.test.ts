// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import type { StaffRole } from "../../../generated/prisma/enums";
import { createServiceService } from "./service";
import {
  parseServiceCreateInput,
  parseServiceListInput,
  parseServiceUpdateInput,
} from "./validation";
import type { ServiceRecord, ServiceRepository } from "./types";

const baseContext = {
  user: {
    id: "user_1",
    email: "admin@clipper.test",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    name: "Niche 72",
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

function createRecord(overrides: Partial<ServiceRecord> = {}): ServiceRecord {
  return {
    id: "service_1",
    barberShopId: "shop_1",
    name: "Classic Cut",
    description: "Haircut and styling",
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

function createRepository(): ServiceRepository {
  return {
    list: vi.fn(async () => [createRecord()]),
    create: vi.fn(async ({ data, barberShopId }) =>
      createRecord({
        barberShopId,
        name: data.name,
        description: data.description,
        durationMinutes: data.durationMinutes,
        price: { toString: () => data.basePrice },
        allowedRoles: data.allowedRoles.map((role: StaffRole) => ({
          id: `allowed_${role}`,
          serviceId: "service_1",
          barberShopId,
          role,
          staffMemberId: null,
          createdAt: now,
        })),
      }),
    ),
    findActiveById: vi.fn(async () => createRecord()),
    update: vi.fn(async ({ data }) =>
      createRecord({
        ...data,
        price: { toString: () => data.basePrice ?? "1500.00" },
        allowedRoles:
          data.allowedRoles?.map((role: StaffRole) => ({
            id: `allowed_${role}`,
            serviceId: "service_1",
            barberShopId: "shop_1",
            role,
            staffMemberId: null,
            createdAt: now,
          })) ?? createRecord().allowedRoles,
      }),
    ),
    softDelete: vi.fn(async ({ deletedAt }) =>
      createRecord({ deletedAt, isActive: false }),
    ),
  };
}

describe("service service", () => {
  let repository: ServiceRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("lists active services scoped to the authenticated tenant", async () => {
    const service = createServiceService(repository);

    await service.list(baseContext, { limit: 50, offset: 0, query: null });

    expect(repository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 50, offset: 0, query: null },
    });
  });

  it("normalizes service list search query", () => {
    expect(
      parseServiceListInput({ limit: "8", offset: "0", query: "  Corte  " }),
    ).toEqual({ limit: 8, offset: 0, query: "Corte" });
  });

  it("normalizes create input, price, duration, and allowed roles", async () => {
    const service = createServiceService(repository);
    const data = parseServiceCreateInput({
      name: " Classic   Cut ",
      description: " Haircut ",
      durationMinutes: "45",
      basePrice: "1500",
      allowedRoles: ["STYLIST", "BARBER", "BARBER"],
    });

    const created = await service.create(baseContext, data);

    expect(repository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: {
        name: "Classic Cut",
        description: "Haircut",
        durationMinutes: 45,
        basePrice: "1500.00",
        allowedRoles: ["BARBER", "STYLIST"],
      },
    });
    expect(created).toEqual(
      expect.objectContaining({
        basePrice: "1500.00",
        allowedRoles: ["BARBER", "STYLIST"],
        createdAt: now.toISOString(),
      }),
    );
    expect(created).not.toHaveProperty("barberShopId");
  });

  it("rejects non-positive duration and price with field-safe errors", () => {
    expect(() =>
      parseServiceCreateInput({
        name: "Cut",
        durationMinutes: 0,
        basePrice: "10.00",
      }),
    ).toThrow(ApiError);

    expect(() =>
      parseServiceCreateInput({
        name: "Cut",
        durationMinutes: 30,
        basePrice: "0",
      }),
    ).toThrow(ApiError);
  });

  it("maps duplicate service names to conflict", async () => {
    repository.create = vi.fn(async () => {
      throw { code: "P2002" };
    });
    const service = createServiceService(repository);

    await expect(
      service.create(
        baseContext,
        parseServiceCreateInput({
          name: "Classic Cut",
          durationMinutes: 45,
          basePrice: "1500.00",
        }),
      ),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Service already exists for this barber shop.",
      }),
    );
  });

  it("rejects non-admin mutations", async () => {
    const service = createServiceService(repository);

    await expect(
      service.create(
        {
          ...baseContext,
          membership: { ...baseContext.membership, role: "STAFF" },
        },
        parseServiceCreateInput({
          name: "Classic Cut",
          durationMinutes: 45,
          basePrice: "1500.00",
        }),
      ),
    ).rejects.toThrow(
      new ApiError({ code: "FORBIDDEN", message: "Admin access is required." }),
    );
  });

  it("updates roles and soft deletes active services only", async () => {
    const service = createServiceService(repository);

    await service.update(
      baseContext,
      "service_1",
      parseServiceUpdateInput({ allowedRoles: ["MANAGER"], basePrice: "1700" }),
    );
    await service.delete(baseContext, "service_1", now);

    expect(repository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "service_1",
      data: { allowedRoles: ["MANAGER"], basePrice: "1700.00" },
    });
    expect(repository.softDelete).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "service_1",
      deletedAt: now,
    });
  });
});
