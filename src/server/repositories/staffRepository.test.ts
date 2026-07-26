// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  staffMember: {
    findFirst: vi.fn(),
    update: vi.fn(),
    findFirstOrThrow: vi.fn(),
  },
  staffMemberRole: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  staffServiceCommission: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  service: {
    findMany: vi.fn(),
  },
  $transaction: vi.fn(async (callback) => callback(prisma)),
}));

vi.mock("../db/client", () => ({ prisma }));

import { staffRepository } from "./staffRepository";

const now = new Date("2026-01-01T00:00:00.000Z");

describe("staffRepository", () => {
  beforeEach(() => {
    prisma.staffMember.findFirst.mockReset().mockResolvedValue({
      id: "staff_1",
      roles: [{ role: "BARBER" }],
    });
    prisma.staffMember.update.mockReset().mockResolvedValue({});
    prisma.staffMember.findFirstOrThrow.mockReset().mockResolvedValue({
      id: "staff_1",
      userId: null,
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada L.",
      email: null,
      normalizedEmail: null,
      phone: null,
      normalizedPhone: null,
      isActive: true,
      commissionMode: "NONE",
      commissionValue: { toString: () => "0.00" },
      workingDays: [],
      restDays: [],
      specialties: [],
      createdAt: now,
      updatedAt: now,
      roles: [{ role: "MANAGER" }],
      serviceCommissions: [],
    });
    prisma.staffMemberRole.deleteMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    prisma.staffMemberRole.createMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    prisma.staffServiceCommission.deleteMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    prisma.staffServiceCommission.createMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    prisma.service.findMany.mockReset().mockResolvedValue([]);
    prisma.$transaction
      .mockReset()
      .mockImplementation(async (callback) => callback(prisma));
  });

  it("prunes stale service commissions when roles change without commission payload", async () => {
    await staffRepository.update({
      barberShopId: "shop_1",
      id: "staff_1",
      data: { roles: ["MANAGER"] },
    });

    expect(prisma.staffServiceCommission.deleteMany).toHaveBeenCalledWith({
      where: {
        staffMemberId: "staff_1",
        barberShopId: "shop_1",
        NOT: {
          service: {
            barberShopId: "shop_1",
            deletedAt: null,
            isActive: true,
            allowedRoles: {
              some: { barberShopId: "shop_1", role: { in: ["MANAGER"] } },
            },
          },
        },
      },
    });
    expect(prisma.staffServiceCommission.createMany).not.toHaveBeenCalled();
  });
});
