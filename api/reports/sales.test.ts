// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const salesReportRepository = { list: vi.fn() };

vi.mock("../../src/server/api/auth", () => ({ getAuthContext }));
vi.mock("../../src/server/repositories/salesReportRepository", () => ({
  salesReportRepository,
}));

const authContext = {
  tenant: {
    barberShopId: "shop_1",
    slug: "clipper",
    timezone: "UTC",
    currency: "COP",
  },
};

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(status: number) {
      this.statusCode = status;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return response as VercelResponse & typeof response;
}

describe("sales report API", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    salesReportRepository.list.mockReset().mockResolvedValue([]);
  });

  it("validates query params and returns a sales report", async () => {
    const { default: handler } = await import("./sales");
    const response = createResponse();

    await handler(
      {
        method: "GET",
        query: { from: "2026-07-27", to: "2026-07-27", itemType: "all" },
      } as unknown as VercelRequest,
      response,
    );

    expect(salesReportRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1" }),
    );
    expect(response.body).toEqual({
      ok: true,
      data: expect.objectContaining({
        summary: expect.objectContaining({ totalRevenue: "0.00" }),
        days: [],
      }),
    });
  });
});
