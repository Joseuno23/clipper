// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import { createQueueService } from "./service";
import type { QueueRepository, QueueTicketRecord } from "./types";

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

const now = new Date("2026-01-01T12:00:00.000Z");

function createTicket(overrides: Partial<QueueTicketRecord> = {}) {
  return {
    id: "appt_1",
    clientId: "client_1",
    staffMemberId: "staff_1",
    status: "CHECKED_IN",
    source: "WALK_IN",
    startAt: now,
    endAt: new Date("2026-01-01T12:45:00.000Z"),
    queueStatus: "WAITING",
    queuedAt: now,
    queuePosition: 2,
    checkedInAt: now,
    createdAt: now,
    updatedAt: now,
    client: { id: "client_1", firstName: "Ada", lastName: "Lovelace" },
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
  } satisfies QueueTicketRecord;
}

function createRepository(): QueueRepository {
  return {
    listLiveQueues: vi.fn(async () => [
      {
        id: "staff_1",
        displayName: "Mora",
        firstName: "Mora",
        lastName: "Paz",
        roles: [{ role: "BARBER" as const }],
        specialties: ["Fade"],
        tickets: [
          createTicket({
            id: "appt_in_service",
            queueStatus: "IN_SERVICE",
            status: "IN_SERVICE",
            queuePosition: 1,
          }),
          createTicket({ id: "appt_waiting", queuePosition: 2 }),
        ],
      },
    ]),
    listAppointmentsByDate: vi.fn(async () => []),
    findActiveClient: vi.fn(async () => ({ id: "client_1" })),
    findActiveStaff: vi.fn(async () => ({ id: "staff_1" })),
    findActiveService: vi.fn(async () => ({
      id: "service_1",
      name: "Classic Cut",
      durationMinutes: 45,
      price: { toString: () => "1500.00" },
    })),
    findActiveServices: vi.fn(async () => [
      {
        id: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: { toString: () => "1500.00" },
      },
      {
        id: "service_2",
        name: "Beard Trim",
        durationMinutes: 20,
        price: { toString: () => "900.00" },
      },
    ]),
    createWalkIn: vi.fn(async () => createTicket()),
    createScheduledAppointment: vi.fn(async ({ data }) =>
      createTicket({
        source: "PHONE",
        startAt: data.startAt,
        endAt: new Date(data.startAt.getTime() + 65 * 60_000),
      }),
    ),
    updateTicket: vi.fn(async ({ data }) =>
      createTicket({
        clientId: data.clientId ?? "client_1",
        staffMemberId: data.staffMemberId ?? "staff_1",
        queueStatus: data.queueStatus ?? "WAITING",
      }),
    ),
    cancelTicket: vi.fn(async () =>
      createTicket({
        status: "CANCELLED",
        queueStatus: "LEFT",
        queuePosition: null,
      }),
    ),
  };
}

describe("queue service", () => {
  let repository: QueueRepository;

  beforeEach(() => {
    repository = createRepository();
  });

  it("lists live queues scoped to tenant with per-staff counts", async () => {
    const service = createQueueService(repository);

    const result = await service.list(baseContext);

    expect(repository.listLiveQueues).toHaveBeenCalledWith({
      barberShopId: "shop_1",
    });
    expect(result.queues[0]).toEqual(
      expect.objectContaining({
        staffId: "staff_1",
        inServiceCount: 1,
        waitingCount: 1,
        totalActiveCount: 2,
      }),
    );
    expect(result.queues[0].tickets[0].checkedInAt).toBe(now.toISOString());
    expect(result.queues[0].tickets[0].services).toEqual([
      {
        serviceId: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: "1500.00",
      },
    ]);
  });

  it("creates walk-ins only after validating tenant-owned references", async () => {
    const service = createQueueService(repository);

    await service.createWalkIn(
      baseContext,
      {
        serviceIds: ["service_1", "service_2"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
      },
      now,
    );

    expect(repository.findActiveClient).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      clientId: "client_1",
    });
    expect(repository.createWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        services: [
          expect.objectContaining({ id: "service_1" }),
          expect.objectContaining({ id: "service_2" }),
        ],
        queuedAt: now,
      }),
    );
  });

  it("rejects walk-ins when any selected service is inactive or cross-tenant", async () => {
    repository.findActiveServices = vi.fn(async () => [
      {
        id: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: { toString: () => "1500.00" },
      },
    ]);
    const service = createQueueService(repository);

    await expect(
      service.createWalkIn(baseContext, {
        serviceIds: ["service_1", "other_service"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message:
          "Walk-in queue ticket references an inactive or missing service.",
      }),
    );
  });

  it("rejects walk-ins with inactive or cross-tenant references", async () => {
    repository.findActiveClient = vi.fn(async () => null);
    const service = createQueueService(repository);

    await expect(
      service.createWalkIn(baseContext, {
        serviceIds: ["service_1"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "other_client" },
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message:
          "Walk-in queue ticket references an inactive or missing client.",
      }),
    );
  });

  it("creates scheduled appointments after validating tenant-owned references", async () => {
    const service = createQueueService(repository);
    const startAt = new Date("2026-01-01T15:00:00.000Z");

    const result = await service.createScheduledAppointment(
      baseContext,
      {
        serviceIds: ["service_1", "service_2"],
        staffMemberId: "staff_1",
        client: { kind: "existing", clientId: "client_1" },
        startAt,
      },
      now,
    );

    expect(repository.createScheduledAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        barberShopId: "shop_1",
        services: [
          expect.objectContaining({ id: "service_1" }),
          expect.objectContaining({ id: "service_2" }),
        ],
        now,
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        source: "PHONE",
        startAt: startAt.toISOString(),
      }),
    );
  });

  it("moves a ticket after validating the destination staff", async () => {
    const service = createQueueService(repository);

    await service.updateTicket(baseContext, "appt_1", {
      staffMemberId: "staff_2",
    });

    expect(repository.findActiveStaff).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      staffMemberId: "staff_2",
    });
    expect(repository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { staffMemberId: "staff_2" },
    });
  });

  it("updates ticket client and services after validating tenant-owned references", async () => {
    const service = createQueueService(repository);

    await service.updateTicket(baseContext, "appt_1", {
      clientId: "client_2",
      serviceIds: ["service_2", "service_1"],
    });

    expect(repository.findActiveClient).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      clientId: "client_2",
    });
    expect(repository.findActiveServices).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      serviceIds: ["service_2", "service_1"],
    });
    expect(repository.updateTicket).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      ticketId: "appt_1",
      data: { clientId: "client_2", serviceIds: ["service_2", "service_1"] },
      services: [
        expect.objectContaining({ id: "service_2" }),
        expect.objectContaining({ id: "service_1" }),
      ],
    });
  });

  it("rejects ticket service edits when any selected service is inactive or cross-tenant", async () => {
    repository.findActiveServices = vi.fn(async () => [
      {
        id: "service_1",
        name: "Classic Cut",
        durationMinutes: 45,
        price: { toString: () => "1500.00" },
      },
    ]);
    const service = createQueueService(repository);

    await expect(
      service.updateTicket(baseContext, "appt_1", {
        serviceIds: ["service_1", "other_service"],
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message:
          "Walk-in queue ticket references an inactive or missing service.",
      }),
    );
  });
});
