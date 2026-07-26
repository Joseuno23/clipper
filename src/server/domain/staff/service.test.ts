// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import type { StaffRole } from "../../../generated/prisma/enums";
import { createStaffService } from "./service";
import { parseStaffCreateInput, parseStaffUpdateInput } from "./validation";
import type {
  NormalizedStaffServiceCommissionInput,
  StaffRecord,
  StaffRepository,
} from "./types";

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
    phone: "+5491112345678",
    normalizedPhone: "+5491112345678",
    isActive: true,
    commissionMode: "PERCENTAGE_BPS",
    commissionValue: { toString: () => "2500.00" },
    workingDays: [1, 2, 3, 4, 5],
    restDays: [now],
    specialties: ["Color", "Fade"],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    roles: [
      {
        id: "staff_role_1",
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

function createRepository(): StaffRepository {
  return {
    list: vi.fn(async () => [createRecord()]),
    create: vi.fn(async ({ data, barberShopId }) =>
      createRecord({
        barberShopId,
        userId: data.userId,
        firstName: data.firstName,
        lastName: data.lastName,
        displayName: data.displayName,
        email: data.email,
        normalizedEmail: data.normalizedEmail,
        phone: data.phone,
        normalizedPhone: data.normalizedPhone,
        isActive: data.isActive,
        commissionMode: data.commissionMode,
        commissionValue: { toString: () => data.commissionValue },
        workingDays: data.workingDays,
        restDays: data.restDays,
        specialties: data.specialties,
        roles: data.roles.map((role: StaffRole) => ({
          id: `role_${role}`,
          staffMemberId: "staff_1",
          barberShopId,
          role,
          createdAt: now,
        })),
        serviceCommissions: data.serviceCommissions.map(toCommissionRecord),
      }),
    ),
    findActiveById: vi.fn(async () => createRecord()),
    update: vi.fn(async ({ data }) =>
      createRecord({
        ...data,
        commissionValue: { toString: () => data.commissionValue ?? "2500.00" },
        roles:
          data.roles?.map((role: StaffRole) => ({
            id: `role_${role}`,
            staffMemberId: "staff_1",
            barberShopId: "shop_1",
            role,
            createdAt: now,
          })) ?? createRecord().roles,
        serviceCommissions:
          data.serviceCommissions?.map(toCommissionRecord) ??
          createRecord().serviceCommissions,
      }),
    ),
    softDelete: vi.fn(async ({ deletedAt }) =>
      createRecord({ deletedAt, isActive: false }),
    ),
  };
}

function toCommissionRecord(commission: NormalizedStaffServiceCommissionInput) {
  return {
    id: `commission_${commission.serviceId}`,
    staffMemberId: "staff_1",
    barberShopId: "shop_1",
    serviceId: commission.serviceId,
    commissionMode: commission.commissionMode,
    commissionValue: { toString: () => commission.commissionValue },
    createdAt: now,
    updatedAt: now,
  };
}

describe("staff service", () => {
  let repository: StaffRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("lists active staff scoped to the authenticated tenant", async () => {
    const service = createStaffService(repository);

    await service.list(baseContext, { limit: 50, offset: 0 });

    expect(repository.list).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      pagination: { limit: 50, offset: 0 },
    });
  });

  it("normalizes and persists staff fields, roles, specialties, rest days, and commission", async () => {
    const service = createStaffService(repository);
    const data = parseStaffCreateInput({
      firstName: " Ada ",
      lastName: " Lovelace ",
      displayName: " Ada   L. ",
      email: "ADA@CLIPPER.TEST",
      phone: " +54 9 11 1234-5678 ",
      isActive: false,
      commissionMode: "PERCENTAGE_BPS",
      commissionValue: "2500",
      workingDays: [5, "1", 1],
      restDays: ["2026-02-01T00:00:00.000Z"],
      specialties: [" Fade ", "Color", "Fade"],
      roles: ["STYLIST", "BARBER", "BARBER"],
      serviceCommissions: [
        {
          serviceId: " service_1 ",
          commissionMode: "PERCENTAGE_BPS",
          commissionValue: "1500",
        },
      ],
    });

    const created = await service.create(baseContext, data);

    expect(repository.create).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      data: expect.objectContaining({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada L.",
        email: "ada@clipper.test",
        normalizedPhone: "+5491112345678",
        isActive: false,
        commissionMode: "PERCENTAGE_BPS",
        commissionValue: "2500.00",
        workingDays: [1, 5],
        specialties: ["Color", "Fade"],
        roles: ["BARBER", "STYLIST"],
        serviceCommissions: [
          {
            serviceId: "service_1",
            commissionMode: "PERCENTAGE_BPS",
            commissionValue: "1500.00",
          },
        ],
      }),
    });
    expect(created).toEqual(
      expect.objectContaining({
        commissionValue: "2500.00",
        roles: ["BARBER", "STYLIST"],
        serviceCommissions: [
          {
            serviceId: "service_1",
            commissionMode: "PERCENTAGE_BPS",
            commissionValue: "1500.00",
          },
        ],
        restDays: ["2026-02-01T00:00:00.000Z"],
        createdAt: now.toISOString(),
      }),
    );
    expect(created).not.toHaveProperty("barberShopId");
  });

  it("validates commission and schedule readiness fields safely", () => {
    expect(() =>
      parseStaffCreateInput({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada",
        commissionMode: "PERCENTAGE_BPS",
        commissionValue: "10001",
      }),
    ).toThrow(ApiError);

    expect(() =>
      parseStaffCreateInput({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada",
        workingDays: [7],
      }),
    ).toThrow(ApiError);

    expect(() =>
      parseStaffCreateInput({
        firstName: "Ada",
        lastName: "Lovelace",
        displayName: "Ada",
        restDays: ["not-a-date"],
      }),
    ).toThrow(ApiError);
  });

  it("maps duplicate unique fields to conflict", async () => {
    repository.create = vi.fn(async () => {
      throw { code: "P2002" };
    });
    const service = createStaffService(repository);

    await expect(
      service.create(
        baseContext,
        parseStaffCreateInput({
          firstName: "Ada",
          lastName: "Lovelace",
          displayName: "Ada",
          email: "ada@clipper.test",
        }),
      ),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Staff member already exists for this barber shop.",
      }),
    );
  });

  it("rejects non-admin mutations", async () => {
    const service = createStaffService(repository);

    await expect(
      service.create(
        {
          ...baseContext,
          membership: { ...baseContext.membership, role: "STAFF" },
        },
        parseStaffCreateInput({
          firstName: "Ada",
          lastName: "Lovelace",
          displayName: "Ada",
        }),
      ),
    ).rejects.toThrow(
      new ApiError({ code: "FORBIDDEN", message: "Admin access is required." }),
    );
  });

  it("updates role assignments and soft deletes active staff only", async () => {
    const service = createStaffService(repository);

    await service.update(
      baseContext,
      "staff_1",
      parseStaffUpdateInput({ roles: ["MANAGER"], commissionMode: "NONE" }),
    );
    await service.delete(baseContext, "staff_1", now);

    expect(repository.update).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "staff_1",
      data: {
        roles: ["MANAGER"],
        commissionMode: "NONE",
        commissionValue: "0.00",
      },
    });
    expect(repository.softDelete).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      id: "staff_1",
      deletedAt: now,
    });
  });
});
