// @vitest-environment node

import "dotenv/config";

import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { prisma as PrismaSingleton } from "../db/client";
import type { queueRepository as QueueRepositorySingleton } from "./queueRepository";

type PrismaClient = typeof PrismaSingleton;
type QueueRepository = typeof QueueRepositorySingleton;

const hasDatabaseUrl = Boolean(process.env["DATABASE_URL"]);

describe.skipIf(!hasDatabaseUrl)("queueRepository integration", () => {
  let prisma: PrismaClient;
  let queueRepository: QueueRepository;

  const createdShopIds: string[] = [];
  const runId = `queue-reorder-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  beforeAll(async () => {
    [{ prisma }, { queueRepository }] = await Promise.all([
      import("../db/client"),
      import("./queueRepository"),
    ]);

    await prisma.$connect();
  });

  afterEach(async () => {
    if (createdShopIds.length === 0) return;

    await prisma.appointmentService.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.appointment.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.client.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.staffMember.deleteMany({
      where: { barberShopId: { in: createdShopIds } },
    });
    await prisma.barberShop.deleteMany({
      where: { id: { in: createdShopIds } },
    });
    createdShopIds.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("renumbers waiting tickets without transient active-position collisions", async () => {
    const barberShop = await prisma.barberShop.create({
      data: {
        name: `${runId} Shop`,
        slug: `${runId}-shop`,
        timezone: "America/Argentina/Buenos_Aires",
      },
    });
    createdShopIds.push(barberShop.id);

    const staffMember = await prisma.staffMember.create({
      data: {
        barberShopId: barberShop.id,
        firstName: "Queue",
        lastName: "Barber",
        displayName: "Queue Barber",
        workingDays: [],
        restDays: [],
        specialties: [],
      },
    });
    const clients = await Promise.all(
      [1, 2, 3, 4].map((position) =>
        prisma.client.create({
          data: {
            barberShopId: barberShop.id,
            firstName: `Client ${position}`,
            lastName: "Queue",
          },
        }),
      ),
    );
    const baseStartAt = new Date("2026-01-01T12:00:00.000Z");

    await Promise.all(
      clients.map((client, index) => {
        const queuePosition = index + 1;

        return prisma.appointment.create({
          data: {
            barberShopId: barberShop.id,
            clientId: client.id,
            staffMemberId: staffMember.id,
            source: "WALK_IN",
            status: queuePosition === 1 ? "IN_SERVICE" : "CHECKED_IN",
            queueStatus: queuePosition === 1 ? "IN_SERVICE" : "WAITING",
            queuedAt: baseStartAt,
            checkedInAt: baseStartAt,
            startAt: baseStartAt,
            endAt: new Date(baseStartAt.getTime() + 30 * 60 * 1000),
            queuePosition,
          },
        });
      }),
    );

    const movingTicket = await prisma.appointment.findFirstOrThrow({
      where: {
        barberShopId: barberShop.id,
        clientId: clients[2]!.id,
      },
      select: { id: true },
    });

    await expect(
      queueRepository.updateTicket({
        barberShopId: barberShop.id,
        ticketId: movingTicket.id,
        data: { positionAction: "UP" },
      }),
    ).resolves.toBeTruthy();

    const positions = await prisma.appointment.findMany({
      where: {
        barberShopId: barberShop.id,
        staffMemberId: staffMember.id,
        source: "WALK_IN",
        deletedAt: null,
      },
      select: { clientId: true, queuePosition: true },
      orderBy: { queuePosition: "asc" },
    });

    expect(positions).toEqual([
      { clientId: clients[0]!.id, queuePosition: 1 },
      { clientId: clients[2]!.id, queuePosition: 2 },
      { clientId: clients[1]!.id, queuePosition: 3 },
      { clientId: clients[3]!.id, queuePosition: 4 },
    ]);
  });
});
