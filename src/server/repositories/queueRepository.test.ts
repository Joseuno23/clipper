// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../api/errors";

const prisma = vi.hoisted(() => ({
  client: {
    create: vi.fn(),
  },
  appointment: {
    aggregate: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  appointmentService: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
  },
  staffMember: {
    findMany: vi.fn(),
  },
  sale: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  saleItem: {
    deleteMany: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
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

const beardService = {
  id: "service_2",
  name: "Beard Trim",
  durationMinutes: 20,
  price: { toString: () => "900.00" },
};

const queuedAt = new Date("2026-01-01T12:00:00.000Z");

describe("queueRepository", () => {
  beforeEach(() => {
    prisma.appointment.aggregate.mockReset().mockResolvedValue({
      _max: { queuePosition: 2 },
    });
    prisma.appointment.count.mockReset().mockResolvedValue(0);
    prisma.appointment.create
      .mockReset()
      .mockResolvedValue({ id: "appt_created" });
    prisma.appointment.findMany.mockReset().mockResolvedValue([]);
    prisma.appointment.findFirst.mockReset().mockResolvedValue({
      id: "appt_1",
      clientId: "client_1",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      startAt: queuedAt,
    });
    prisma.staffMember.findMany.mockReset().mockResolvedValue([]);
    prisma.appointment.update.mockReset().mockResolvedValue({});
    prisma.appointmentService.deleteMany
      .mockReset()
      .mockResolvedValue({ count: 1 });
    prisma.appointmentService.createMany
      .mockReset()
      .mockResolvedValue({ count: 2 });
    prisma.sale.create.mockReset().mockResolvedValue({ id: "sale_1" });
    prisma.sale.findFirst.mockReset().mockResolvedValue({ id: "sale_1" });
    prisma.sale.update.mockReset().mockResolvedValue({ id: "sale_1" });
    prisma.saleItem.deleteMany.mockReset().mockResolvedValue({ count: 1 });
    prisma.saleItem.createMany.mockReset().mockResolvedValue({ count: 2 });
    prisma.saleItem.findMany.mockReset().mockResolvedValue([]);
    prisma.client.create.mockReset().mockResolvedValue({ id: "client_new" });
    prisma.$executeRawUnsafe.mockReset().mockResolvedValue(undefined);
    prisma.$transaction
      .mockReset()
      .mockImplementation(async (callback) => callback(prisma));
  });

  it("creates walk-ins directly in service when the destination queue is empty", async () => {
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: null },
    });

    await queueRepository.createWalkIn({
      barberShopId: "shop_1",
      data: {
        serviceIds: ["service_1"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
      },
      services: [service],
      queuedAt,
    });

    expect(prisma.$executeRawUnsafe).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      "shop_1:staff_1:walk-in-queue",
    );
    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "IN_SERVICE",
          queueStatus: "IN_SERVICE",
          queuePosition: 1,
        }),
      }),
    );
    expect(prisma.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt_created",
          status: "DRAFT",
          businessDate: new Date("2026-01-01T12:00:00.000Z"),
        }),
      }),
    );
  });

  it("creates walk-ins waiting after the in-service ticket when staff is occupied", async () => {
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.createWalkIn({
      barberShopId: "shop_1",
      data: {
        serviceIds: ["service_1"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
      },
      services: [service],
      queuedAt,
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 2,
        }),
      }),
    );
  });

  it("creates walk-ins at the destination queue end while counting in-service tickets", async () => {
    await queueRepository.createWalkIn({
      barberShopId: "shop_1",
      data: {
        serviceIds: ["service_1", "service_2"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
      },
      services: [service, beardService],
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
        data: expect.objectContaining({
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 3,
          endAt: new Date("2026-01-01T13:05:00.000Z"),
          services: {
            create: [
              expect.objectContaining({ serviceId: "service_1", sortOrder: 0 }),
              expect.objectContaining({ serviceId: "service_2", sortOrder: 1 }),
            ],
          },
        }),
      }),
    );
  });

  it("prevents creating a second active walk-in for the same client", async () => {
    prisma.appointment.count.mockResolvedValueOnce(1);

    await expect(
      queueRepository.createWalkIn({
        barberShopId: "shop_1",
        data: {
          serviceIds: ["service_1"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
        },
        services: [service],
        queuedAt,
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Client already has an active walk-in queue ticket.",
      }),
    );

    expect(prisma.appointment.count).toHaveBeenCalledWith({
      where: {
        barberShopId: "shop_1",
        clientId: "client_1",
        deletedAt: null,
        queueStatus: { in: ["IN_SERVICE", "CALLED", "WAITING"] },
      },
    });
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("creates a new client and walk-in appointment in the same transaction", async () => {
    const transactionalClient = {
      ...prisma,
      client: { create: vi.fn().mockResolvedValue({ id: "client_new" }) },
      appointment: {
        ...prisma.appointment,
        aggregate: vi.fn().mockResolvedValue({ _max: { queuePosition: null } }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    prisma.$transaction.mockImplementationOnce(async (callback) =>
      callback(transactionalClient),
    );

    await queueRepository.createWalkIn({
      barberShopId: "shop_1",
      data: {
        serviceIds: ["service_1"],
        staffMemberId: "staff_1",
        client: {
          kind: "new",
          firstName: "Ada",
          lastName: "Lovelace",
          phone: "11 5555-4444",
          normalizedPhone: "1155554444",
          documentNumber: "20-123.456",
          normalizedDocument: "20123456",
        },
      },
      services: [service],
      queuedAt,
    });

    expect(transactionalClient.client.create).toHaveBeenCalledWith({
      data: {
        barberShopId: "shop_1",
        firstName: "Ada",
        lastName: "Lovelace",
        phone: "11 5555-4444",
        normalizedPhone: "1155554444",
        documentNumber: "20-123.456",
        normalizedDocument: "20123456",
      },
      select: { id: true },
    });
    expect(transactionalClient.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ clientId: "client_new" }),
      }),
    );
    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("rejects scheduled appointments when active queue overruns requested time", async () => {
    prisma.appointment.findMany.mockResolvedValueOnce([
      availabilityTicket({
        id: "chair",
        queueStatus: "IN_SERVICE",
        queuePosition: 1,
        durationMinutes: 65,
      }),
      availabilityTicket({
        id: "waiting",
        queueStatus: "WAITING",
        queuePosition: 2,
        durationMinutes: 65,
      }),
    ]);

    await expect(
      queueRepository.createScheduledAppointment({
        barberShopId: "shop_1",
        data: {
          serviceIds: ["service_1"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
          startAt: new Date("2026-01-01T11:00:00.000Z"),
        },
        services: [service],
        now: new Date("2026-01-01T10:00:00.000Z"),
      }),
    ).rejects.toThrow(/unavailable/);

    expect(prisma.appointment.create).not.toHaveBeenCalled();
  });

  it("accepts scheduled appointments outside the live queue and creates draft sale", async () => {
    prisma.appointment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await queueRepository.createScheduledAppointment({
      barberShopId: "shop_1",
      timeZone: "America/Argentina/Buenos_Aires",
      data: {
        serviceIds: ["service_1", "service_2"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
        startAt: new Date("2026-01-02T15:00:00.000Z"),
      },
      services: [service, beardService],
      now: queuedAt,
    });

    expect(prisma.appointment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "PHONE",
          status: "SCHEDULED",
          queueStatus: "NOT_QUEUED",
          queuedAt: null,
          checkedInAt: null,
          queuePosition: null,
          startAt: new Date("2026-01-02T15:00:00.000Z"),
          endAt: new Date("2026-01-02T16:05:00.000Z"),
          services: {
            create: [
              expect.objectContaining({ serviceId: "service_1", sortOrder: 0 }),
              expect.objectContaining({ serviceId: "service_2", sortOrder: 1 }),
            ],
          },
        }),
      }),
    );
    expect(prisma.appointment.aggregate).not.toHaveBeenCalled();
    expect(prisma.sale.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          appointmentId: "appt_created",
          status: "DRAFT",
          businessDate: new Date("2026-01-02T12:00:00.000Z"),
        }),
      }),
    );
  });

  it("keeps scheduled appointments outside the projection window out of live queues", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "scheduled_later",
          source: "PHONE",
          status: "SCHEDULED",
          queueStatus: "NOT_QUEUED",
          startAt: new Date("2026-01-01T17:00:00.000Z"),
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([]);

    try {
      const queues = await queueRepository.listLiveQueues({
        barberShopId: "shop_1",
      });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { queueStatus: { in: ["IN_SERVICE", "CALLED", "WAITING"] } },
              {
                source: { not: "WALK_IN" },
                status: { in: ["SCHEDULED", "CONFIRMED"] },
                queueStatus: "NOT_QUEUED",
                queuePosition: null,
                startAt: { gte: new Date("2026-01-01T10:00:00.000Z") },
              },
            ],
          }),
        }),
      );
      expect(prisma.appointment.update).not.toHaveBeenCalled();
      expect(queues).toEqual([
        expect.objectContaining({ id: "staff_1", tickets: [] }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("activates scheduled appointments inside the projection window at the crossed slot", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "chair",
          queueStatus: "IN_SERVICE",
          queuePosition: 1,
          durationMinutes: 65,
        }),
        availabilityTicket({
          id: "scheduled_13",
          source: "PHONE",
          status: "SCHEDULED",
          queueStatus: "NOT_QUEUED",
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "chair",
          queueStatus: "IN_SERVICE",
          queuePosition: 1,
          durationMinutes: 65,
        }),
        availabilityTicket({
          id: "scheduled_13",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 3,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ]);

    try {
      const queues = await queueRepository.listLiveQueues({
        barberShopId: "shop_1",
      });

      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "scheduled_13" },
        data: {
          queueStatus: "WAITING",
          status: "CHECKED_IN",
          queuePosition: 3,
          queuedAt: new Date("2026-01-01T10:00:00.000Z"),
          checkedInAt: new Date("2026-01-01T10:00:00.000Z"),
        },
      });
      expect(queues[0].tickets.map((ticket) => ticket.id)).toEqual([
        "chair",
        "scheduled_13",
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not activate stale scheduled appointments before now", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "scheduled_old",
          source: "PHONE",
          status: "SCHEDULED",
          queueStatus: "NOT_QUEUED",
          startAt: new Date("2026-01-01T09:00:00.000Z"),
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([]);

    try {
      const queues = await queueRepository.listLiveQueues({
        barberShopId: "shop_1",
      });

      expect(prisma.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                startAt: { gte: new Date("2026-01-01T10:00:00.000Z") },
              }),
            ]),
          }),
        }),
      );
      expect(prisma.appointment.update).not.toHaveBeenCalled();
      expect(queues[0].tickets).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not reproject already active scheduled appointments", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "scheduled_moved",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 5,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "scheduled_moved",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 5,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ]);

    try {
      const queues = await queueRepository.listLiveQueues({
        barberShopId: "shop_1",
      });

      expect(prisma.appointment.update).not.toHaveBeenCalled();
      expect(queues[0].tickets[0]).toEqual(
        expect.objectContaining({ id: "scheduled_moved", queuePosition: 5 }),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not move already active appointments when activating a projected appointment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "chair",
          queueStatus: "IN_SERVICE",
          queuePosition: 1,
          durationMinutes: 65,
        }),
        availabilityTicket({
          id: "scheduled_moved",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 5,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
        availabilityTicket({
          id: "scheduled_new",
          source: "PHONE",
          status: "SCHEDULED",
          queueStatus: "NOT_QUEUED",
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "chair",
          queueStatus: "IN_SERVICE",
          queuePosition: 1,
          durationMinutes: 65,
        }),
        availabilityTicket({
          id: "scheduled_new",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 3,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
        availabilityTicket({
          id: "scheduled_moved",
          source: "PHONE",
          status: "CHECKED_IN",
          queueStatus: "WAITING",
          queuePosition: 5,
          startAt: new Date("2026-01-01T13:00:00.000Z"),
          durationMinutes: 45,
        }),
      ]);

    try {
      const queues = await queueRepository.listLiveQueues({
        barberShopId: "shop_1",
      });

      expect(prisma.appointment.update).toHaveBeenCalledTimes(1);
      expect(prisma.appointment.update).toHaveBeenCalledWith({
        where: { id: "scheduled_new" },
        data: expect.objectContaining({ queuePosition: 3 }),
      });
      expect(queues[0].tickets).toEqual([
        expect.objectContaining({ id: "chair", queuePosition: 1 }),
        expect.objectContaining({ id: "scheduled_new", queuePosition: 3 }),
        expect.objectContaining({ id: "scheduled_moved", queuePosition: 5 }),
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("continues listing active walk-ins without projection changes", async () => {
    prisma.staffMember.findMany.mockResolvedValueOnce([
      {
        id: "staff_1",
        displayName: "Grace Hopper",
        firstName: "Grace",
        lastName: "Hopper",
        roles: [],
        specialties: [],
      },
    ]);
    prisma.appointment.findMany
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "walk_in",
          queueStatus: "WAITING",
          queuePosition: 2,
          durationMinutes: 45,
        }),
      ])
      .mockResolvedValueOnce([
        availabilityTicket({
          id: "walk_in",
          queueStatus: "WAITING",
          queuePosition: 2,
          durationMinutes: 45,
        }),
      ]);

    const queues = await queueRepository.listLiveQueues({
      barberShopId: "shop_1",
    });

    expect(prisma.appointment.update).not.toHaveBeenCalled();
    expect(queues[0].tickets).toEqual([
      expect.objectContaining({ id: "walk_in", queueStatus: "WAITING" }),
    ]);
  });

  it("includes existing scheduled appointments in availability conflicts", async () => {
    prisma.appointment.findMany.mockResolvedValueOnce([
      availabilityTicket({
        id: "scheduled",
        queueStatus: "NOT_QUEUED",
        status: "SCHEDULED",
        startAt: new Date("2026-01-01T15:00:00.000Z"),
        durationMinutes: 45,
      }),
    ]);

    await expect(
      queueRepository.createScheduledAppointment({
        barberShopId: "shop_1",
        data: {
          serviceIds: ["service_2"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
          startAt: new Date("2026-01-01T15:30:00.000Z"),
        },
        services: [beardService],
        now: queuedAt,
      }),
    ).rejects.toThrow(/unavailable/);
  });

  it("keeps queued phone appointments fixed at their scheduled time for availability", async () => {
    prisma.appointment.findMany.mockResolvedValueOnce([
      availabilityTicket({
        id: "scheduled_in_queue",
        source: "PHONE",
        queueStatus: "WAITING",
        status: "CHECKED_IN",
        queuePosition: 1,
        startAt: new Date("2026-01-01T15:00:00.000Z"),
        durationMinutes: 45,
      }),
    ]);

    await expect(
      queueRepository.createScheduledAppointment({
        barberShopId: "shop_1",
        data: {
          serviceIds: ["service_2"],
          staffMemberId: "staff_1",
          client: { kind: "existing", clientId: "client_1" },
          startAt: new Date("2026-01-01T15:30:00.000Z"),
        },
        services: [beardService],
        now: new Date("2026-01-01T10:00:00.000Z"),
      }),
    ).rejects.toThrow(/unavailable/);
  });

  it("moves waiting tickets to the destination queue end", async () => {
    prisma.appointment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "appt_1", queuePosition: 3, queuedAt }]);

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
          queueStatus: "WAITING",
          status: "CHECKED_IN",
          queuePosition: 3,
        }),
      }),
    );
  });

  it("moves waiting tickets to an empty destination queue as in service", async () => {
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: null },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffMemberId: "staff_2",
          queueStatus: "IN_SERVICE",
          status: "IN_SERVICE",
          queuePosition: 1,
        }),
      }),
    );
  });

  it("moves in-service tickets to an empty destination queue", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "IN_SERVICE",
      queuePosition: 1,
      startAt: queuedAt,
    });
    prisma.appointment.aggregate
      .mockResolvedValueOnce({ _max: { queuePosition: null } })
      .mockResolvedValueOnce({ _max: { queuePosition: 1 } });
    prisma.appointment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffMemberId: "staff_2",
          queueStatus: "IN_SERVICE",
          status: "IN_SERVICE",
          queuePosition: 1,
        }),
      }),
    );
  });

  it("moves in-service tickets to an occupied destination as waiting and promotes the source queue", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "IN_SERVICE",
      queuePosition: 1,
      startAt: queuedAt,
    });
    prisma.appointment.aggregate
      .mockResolvedValueOnce({ _max: { queuePosition: 1 } })
      .mockResolvedValueOnce({ _max: { queuePosition: 1 } })
      .mockResolvedValueOnce({ _max: { queuePosition: 1 } });
    prisma.appointment.count.mockResolvedValueOnce(1);
    prisma.appointment.findMany
      .mockResolvedValueOnce([{ id: "appt_2", queuePosition: 2, queuedAt }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "appt_1", queuePosition: 2, queuedAt }]);

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          staffMemberId: "staff_2",
          queueStatus: "WAITING",
          status: "CHECKED_IN",
          queuePosition: 2,
        }),
      }),
    );
    expect(prisma.appointment.count).not.toHaveBeenCalled();
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: {
        queueStatus: "IN_SERVICE",
        status: "IN_SERVICE",
        queuePosition: 1,
        checkedInAt: expect.any(Date),
      },
    });
  });

  it("moves waiting tickets up and renumbers waiting positions", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_2",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      queuePosition: 3,
      startAt: queuedAt,
    });
    prisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", queuePosition: 2, queuedAt },
      { id: "appt_2", queuePosition: 3, queuedAt },
      { id: "appt_3", queuePosition: 4, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_2",
      data: { positionAction: "UP" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: { queuePosition: 2 },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: { queuePosition: 3 },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 4 },
    });
  });

  it("clears waiting positions before assigning reordered positions", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_2",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      queuePosition: 3,
      startAt: queuedAt,
    });
    prisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", queuePosition: 2, queuedAt },
      { id: "appt_2", queuePosition: 3, queuedAt },
      { id: "appt_3", queuePosition: 4, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_2",
      data: { positionAction: "UP" },
    });

    const positionUpdates = prisma.appointment.update.mock.calls.filter(
      ([input]) => "queuePosition" in input.data,
    );

    expect(positionUpdates.slice(0, 3).map(([input]) => input)).toEqual([
      { where: { id: "appt_2" }, data: { queuePosition: null } },
      { where: { id: "appt_1" }, data: { queuePosition: null } },
      { where: { id: "appt_3" }, data: { queuePosition: null } },
    ]);
    expect(positionUpdates.slice(3).map(([input]) => input)).toEqual([
      { where: { id: "appt_2" }, data: { queuePosition: 2 } },
      { where: { id: "appt_1" }, data: { queuePosition: 3 } },
      { where: { id: "appt_3" }, data: { queuePosition: 4 } },
    ]);
  });

  it("moves waiting tickets down and renumbers waiting positions", async () => {
    prisma.appointment.findMany.mockResolvedValue([
      { id: "appt_1", queuePosition: 2, queuedAt },
      { id: "appt_2", queuePosition: 3, queuedAt },
      { id: "appt_3", queuePosition: 4, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { positionAction: "DOWN" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: { queuePosition: 2 },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: { queuePosition: 3 },
    });
  });

  it("renumbers waiting tickets after called tickets to keep active positions unique", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_3",
      staffMemberId: "staff_1",
      queueStatus: "WAITING",
      queuePosition: 4,
      startAt: queuedAt,
    });
    prisma.appointment.findMany.mockResolvedValue([
      { id: "appt_2", queuePosition: 3, queuedAt },
      { id: "appt_3", queuePosition: 4, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 2 },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_3",
      data: { positionAction: "UP" },
    });

    expect(prisma.appointment.aggregate).toHaveBeenCalledWith({
      where: expect.objectContaining({
        barberShopId: "shop_1",
        staffMemberId: "staff_1",
        queueStatus: { in: ["IN_SERVICE", "CALLED"] },
      }),
      _max: { queuePosition: true },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: 3 },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: { queuePosition: 4 },
    });
  });

  it("promotes a waiting ticket to an empty chair and renumbers waiting tickets", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({
        id: "appt_3",
        staffMemberId: "staff_1",
        queueStatus: "WAITING",
        queuePosition: 3,
        startAt: queuedAt,
      })
      .mockResolvedValueOnce(null);
    prisma.appointment.findMany.mockResolvedValueOnce([
      { id: "appt_2", queuePosition: 2, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_3",
      data: { positionAction: "CHAIR" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_3" },
      data: { queuePosition: null },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt_3" },
        data: {
          queueStatus: "IN_SERVICE",
          status: "IN_SERVICE",
          queuePosition: 1,
          checkedInAt: expect.any(Date),
        },
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: { queuePosition: 2 },
    });
  });

  it("promotes waiting #2 to an occupied chair and swaps the previous chair to #2", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({
        id: "appt_2",
        staffMemberId: "staff_1",
        queueStatus: "WAITING",
        queuePosition: 2,
        startAt: queuedAt,
      })
      .mockResolvedValueOnce({ id: "appt_1", queuePosition: 1 });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_2",
      data: { positionAction: "CHAIR" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        queueStatus: "WAITING",
        status: "CHECKED_IN",
        queuePosition: null,
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "appt_2" },
        data: {
          queueStatus: "IN_SERVICE",
          status: "IN_SERVICE",
          queuePosition: 1,
          checkedInAt: expect.any(Date),
        },
      }),
    );
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: { queuePosition: 2 },
    });
  });

  it("promotes a deeper waiting ticket and preserves the old chair at the selected position", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({
        id: "appt_4",
        staffMemberId: "staff_1",
        queueStatus: "WAITING",
        queuePosition: 4,
        startAt: queuedAt,
      })
      .mockResolvedValueOnce({ id: "appt_1", queuePosition: 1 });

    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_4",
      data: { positionAction: "CHAIR" },
    });

    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: { queuePosition: 4 },
    });
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });

  it("prevents reordering in-service tickets", async () => {
    prisma.appointment.findFirst.mockResolvedValue({
      id: "appt_1",
      staffMemberId: "staff_1",
      queueStatus: "IN_SERVICE",
      queuePosition: 1,
      startAt: queuedAt,
    });

    await expect(
      queueRepository.updateTicket({
        barberShopId: "shop_1",
        ticketId: "appt_1",
        data: { positionAction: "DOWN" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Only waiting queue tickets can be reordered.",
      }),
    );
  });

  it("prevents multiple in-service tickets for the same staff", async () => {
    prisma.appointment.count.mockResolvedValueOnce(1);

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

  it("prevents changing a ticket to a client with another active walk-in", async () => {
    prisma.appointment.count.mockResolvedValueOnce(1);

    await expect(
      queueRepository.updateTicket({
        barberShopId: "shop_1",
        ticketId: "appt_1",
        data: { clientId: "client_2" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "CONFLICT",
        message: "Client already has an active walk-in queue ticket.",
      }),
    );

    expect(prisma.appointment.count).toHaveBeenCalledWith({
      where: {
        id: { not: "appt_1" },
        barberShopId: "shop_1",
        clientId: "client_2",
        deletedAt: null,
        queueStatus: { in: ["IN_SERVICE", "CALLED", "WAITING"] },
      },
    });
    expect(prisma.appointment.update).not.toHaveBeenCalled();
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

  it("replaces ticket client and service snapshots transactionally", async () => {
    await queueRepository.updateTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { clientId: "client_2", serviceIds: ["service_2", "service_1"] },
      services: [beardService, service],
    });

    expect(prisma.appointment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: "appt_1",
          barberShopId: "shop_1",
          deletedAt: null,
        }),
      }),
    );
    expect(prisma.appointmentService.deleteMany).toHaveBeenCalledWith({
      where: { appointmentId: "appt_1", barberShopId: "shop_1" },
    });
    expect(prisma.appointmentService.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          appointmentId: "appt_1",
          barberShopId: "shop_1",
          serviceId: "service_2",
          serviceNameSnapshot: "Beard Trim",
          sortOrder: 0,
        }),
        expect.objectContaining({
          appointmentId: "appt_1",
          barberShopId: "shop_1",
          serviceId: "service_1",
          serviceNameSnapshot: "Classic Cut",
          sortOrder: 1,
        }),
      ],
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client_2",
          endAt: new Date("2026-01-01T13:05:00.000Z"),
        }),
      }),
    );
  });

  it("cancels an active ticket and its linked draft sale", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({ id: "appt_1", queueStatus: "WAITING" })
      .mockResolvedValueOnce({
        id: "appt_1",
        staffMemberId: "staff_1",
        queueStatus: "WAITING",
        queuePosition: 2,
      })
      .mockResolvedValueOnce({ id: "appt_1" });
    prisma.sale.findFirst.mockResolvedValueOnce({
      id: "sale_1",
      status: "DRAFT",
    });
    prisma.appointment.findMany.mockResolvedValueOnce([
      { id: "appt_2", queuePosition: 3, queuedAt },
    ]);
    prisma.appointment.aggregate.mockResolvedValueOnce({
      _max: { queuePosition: 1 },
    });

    await queueRepository.cancelTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      reason: "Cliente canceló",
    });

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: { status: "CANCELLED", cancellationReason: "Cliente canceló" },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        queueStatus: "LEFT",
        status: "CANCELLED",
        queuePosition: null,
        cancellationReason: "Cliente canceló",
      },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_2" },
      data: { queuePosition: 2 },
    });
  });

  it("cancels a scheduled NOT_QUEUED appointment and its linked draft sale without queue promotion", async () => {
    prisma.appointment.findFirst
      .mockResolvedValueOnce({ id: "appt_1", queueStatus: "NOT_QUEUED" })
      .mockResolvedValueOnce({ id: "appt_1" });
    prisma.sale.findFirst.mockResolvedValueOnce({
      id: "sale_1",
      status: "DRAFT",
    });

    await queueRepository.cancelTicket({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      reason: "Cliente canceló",
    });

    expect(prisma.sale.update).toHaveBeenCalledWith({
      where: { id: "sale_1" },
      data: { status: "CANCELLED", cancellationReason: "Cliente canceló" },
    });
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: "appt_1" },
      data: {
        queueStatus: "LEFT",
        status: "CANCELLED",
        queuePosition: null,
        cancellationReason: "Cliente canceló",
      },
    });
    expect(prisma.$executeRawUnsafe).not.toHaveBeenCalled();
    expect(prisma.appointment.findMany).not.toHaveBeenCalled();
  });
});

function availabilityTicket({
  id,
  source = "WALK_IN",
  queueStatus,
  status = "CHECKED_IN",
  queuePosition = null,
  startAt = queuedAt,
  durationMinutes,
}: {
  id: string;
  source?: string;
  queueStatus: string;
  status?: string;
  queuePosition?: number | null;
  startAt?: Date;
  durationMinutes: number;
}) {
  return {
    id,
    staffMemberId: "staff_1",
    source,
    status,
    queueStatus,
    queuePosition,
    queuedAt: startAt,
    startAt,
    endAt: new Date(startAt.getTime() + durationMinutes * 60_000),
    services: [{ serviceDurationSnapshot: durationMinutes }],
    client: null,
  };
}
