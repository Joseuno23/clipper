// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const staffLiquidationRepository = { list: vi.fn() };

vi.mock("../../src/server/api/auth", () => ({ getAuthContext }));
vi.mock("../../src/server/repositories/staffLiquidationRepository", () => ({
  staffLiquidationRepository,
}));

const authContext = {
  user: {
    id: "user_1",
    email: "admin@test.dev",
    displayName: "Admin",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    slug: "clipper",
    timezone: "UTC",
    currency: "ARS",
  },
  membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
  tokenClaims: {
    sub: "user_1",
    barberShopId: "shop_1",
    barberShopSlug: "clipper",
    role: "OWNER",
    membershipStatus: "ACTIVE",
    typ: "access",
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

describe("staff liquidation API", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(authContext);
    staffLiquidationRepository.list
      .mockReset()
      .mockResolvedValue({ sales: [] });
  });

  it("validates query params and returns the auth envelope", async () => {
    const { default: handler } = await import("./staff-liquidations");
    const response = createResponse();

    await handler(
      {
        method: "GET",
        query: { from: "2026-07-27", to: "2026-07-27", staffMemberId: "all" },
      } as unknown as VercelRequest,
      response,
    );

    expect(getAuthContext).toHaveBeenCalled();
    expect(staffLiquidationRepository.list).toHaveBeenCalledWith(
      expect.objectContaining({ barberShopId: "shop_1" }),
    );
    expect(response.body).toEqual({
      ok: true,
      data: expect.objectContaining({ summaries: [], details: [] }),
    });
  });

  it("rejects invalid ranges before hitting the repository", async () => {
    const { default: handler } = await import("./staff-liquidations");
    const response = createResponse();

    await handler(
      {
        method: "GET",
        query: { from: "2026-07-28", to: "2026-07-27", staffMemberId: "all" },
      } as unknown as VercelRequest,
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(staffLiquidationRepository.list).not.toHaveBeenCalled();
  });
});
