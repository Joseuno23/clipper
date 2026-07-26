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
    findActiveClient: vi.fn(async () => ({ id: "client_1" })),
    findActiveStaff: vi.fn(async () => ({ id: "staff_1" })),
    findActiveService: vi.fn(async () => ({
      id: "service_1",
      name: "Classic Cut",
      durationMinutes: 45,
      price: { toString: () => "1500.00" },
    })),
    createWalkIn: vi.fn(async () => createTicket()),
    updateTicket: vi.fn(async ({ data }) =>
      createTicket({
        staffMemberId: data.staffMemberId ?? "staff_1",
        queueStatus: data.queueStatus ?? "WAITING",
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
  });

  it("creates walk-ins only after validating tenant-owned references", async () => {
    const service = createQueueService(repository);

    await service.createWalkIn(
      baseContext,
      {
        clientId: "client_1",
        serviceId: "service_1",
        staffMemberId: "staff_1",
      },
      now,
    );

    expect(repository.findActiveClient).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      clientId: "client_1",
    });
    expect(repository.createWalkIn).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1", queuedAt: now }),
    );
  });

  it("rejects walk-ins with inactive or cross-tenant references", async () => {
    repository.findActiveClient = vi.fn(async () => null);
    const service = createQueueService(repository);

    await expect(
      service.createWalkIn(baseContext, {
        clientId: "other_client",
        serviceId: "service_1",
        staffMemberId: "staff_1",
      }),
    ).rejects.toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message:
          "Walk-in queue ticket references an inactive or missing client.",
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
});
