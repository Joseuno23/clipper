// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";

const prisma = vi.hoisted(() => ({
  appointment: {
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  $executeRawUnsafe: vi.fn(),
  $transaction: vi.fn(async (callback) => callback(prisma)),
}));

vi.mock("../db/client", () => ({ prisma }));

import { queueRepository } from "./queueRepository";

const service = {
  id: "service_1",
  name: "Classic Cut",
  durationMinutes: 45,
  price: { toString: () => "1500.00" },
};

const queuedAt = new Date("2026-01-01T12:00:00.000Z");

describe("queueRepository", () => {
  beforeEach(() => {
    prisma.appointment.aggregate.mockReset().mockResolvedValue({
      _max: { queuePosition: 2 },
    });
    prisma.appointment.count.mockReset().mockResolvedValue(0);
    prisma.appointment.create.mockReset().mockResolvedValue({});
    prisma.appointment.findFirst.mockReset().mockResolvedValue({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
    });
    prisma.appointment.update.mockReset().mockResolvedValue({});
    prisma.$executeRawUnsafe.mockReset().mockResolvedValue(undefined);
    prisma.$transaction
      .mockReset()
      .mockImplementation(async (callback) => callback(prisma));
  });

  it("creates walk-ins at the destination queue end while counting in-service tickets", async () => {
    await queueRepository.createWalkIn({
      barberShopId: "shop_1",
      data: {
        clientId: "client_1",
        serviceId: "service_1",
        staffMemberId: "staff_1",
      },
      service,
      queuedAt,
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "shop_1:staff_1:walk-in-queue",
    );
    expect(prisma.appointment.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        barberShopId: "shop_1",
        staffMemberId: "staff_1",
        queueStatus: { in: ["IN_SERVICE", "CALLED", "WAITING"] },
      }),
      _max: { queuePosition: true },
    });
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ queuePosition: 3 }),
      }),
    );
  });

  it("moves waiting tickets to the destination queue end", async () => {
    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });

    expect(prisma.appointment.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        barberShopId: "shop_1",
        staffMemberId: "staff_2",
      }),
      _max: { queuePosition: true },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffMemberId: "staff_2",
          queuePosition: 3,
        }),
      }),
    );
  });

  it("prevents multiple in-service tickets for the same staff", async () => {
    prisma.appointment.count.mockResolvedValue(1);

    await expect(
      queueRepository.updateTicket({
        barberShopId: "shop_1",
        ticketId: "appt_1",
        data: { queueStatus: "IN_SERVICE" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Staff member already has a queue ticket in service.",
      }),
    );
  });

  it("prevents moving finished tickets", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "SERVED",
    });

    await expect(
      queueRepository.updateTicket({
        barberShopId: "shop_1",
        ticketId: "appt_1",
        data: { staffMemberId: "staff_2" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Only active queue tickets can be updated.",
      }),
    );
  });
});
