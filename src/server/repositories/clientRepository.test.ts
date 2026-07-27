// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = vi.hoisted(() => ({
  client: {
    findMany: vi.fn(),
  },
}));

vi.mock("../db/client", () => ({ prisma }));

import { clientRepository } from "./clientRepository";

describe("clientRepository", () => {
  beforeEach(() => {
    prisma.client.findMany.mockReset();
  });

  it("prioritizes exact document matches before filling search suggestions", async () => {
    const exactClient = { id: "client_exact" };
    const fuzzyClient = { id: "client_fuzzy" };
    prisma.client.findMany
      .mockResolvedValueOnce([exactClient])
      .mockResolvedValueOnce([fuzzyClient]);

    await expect(
      clientRepository.list({
        barberShopId: "shop_1",
        pagination: { limit: 10, offset: 0, query: "20.123.456" },
      }),
    ).resolves.toEqual([exactClient, fuzzyClient]);

    expect(prisma.client.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ normalizedDocument: "20123456" }),
        take: 10,
      }),
    );
    expect(prisma.client.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          normalizedDocument: { not: "20123456" },
        }),
        take: 9,
      }),
    );
  });
});
