// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getAuthContext = vi.fn();
const requireAdminCapable = vi.fn();
const verifyPassword = vi.fn();
const hashPassword = vi.fn();
const settingsRepository = {
  updateShopName: vi.fn(),
  updateUserDisplayName: vi.fn(),
  findUserPasswordHash: vi.fn(),
  updateUserPassword: vi.fn(),
};

vi.mock("../../src/server/api/auth", () => ({
  getAuthContext,
  requireAdminCapable,
}));

vi.mock("../../src/server/domain/auth/password", () => ({
  verifyPassword,
  hashPassword,
}));

vi.mock("../../src/server/repositories/settingsRepository", () => ({
  settingsRepository,
}));

const authContext = {
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

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    ...overrides,
  } as VercelRequest;
}

describe("settings API handlers", () => {
  beforeEach(() => {
    vi.resetModules();
    getAuthContext.mockReset().mockResolvedValue(structuredClone(authContext));
    requireAdminCapable.mockReset();
    verifyPassword.mockReset().mockResolvedValue(true);
    hashPassword.mockReset().mockResolvedValue("hash_new");
    settingsRepository.updateShopName.mockReset().mockResolvedValue(undefined);
    settingsRepository.updateUserDisplayName
      .mockReset()
      .mockResolvedValue(undefined);
    settingsRepository.findUserPasswordHash
      .mockReset()
      .mockResolvedValue("hash_current");
    settingsRepository.updateUserPassword
      .mockReset()
      .mockResolvedValue(undefined);
  });

  it("returns current basic settings from auth context", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(createRequest({ method: "GET" }), response);

    expect(response.body).toEqual({
      ok: true,
      data: {
        shop: { name: "Niche 72", slug: "niche-72" },
        user: { displayName: "Admin", email: "admin@clipper.test" },
      },
    });
  });

  it("updates shop name with admin guard and user display name", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        body: { shopName: " Nueva Barbería ", displayName: " Jose " },
      }),
      response,
    );

    expect(requireAdminCapable).toHaveBeenCalled();
    expect(settingsRepository.updateShopName).toHaveBeenCalledWith({
      barberShopId: "shop_1",
      name: "Nueva Barbería",
    });
    expect(settingsRepository.updateUserDisplayName).toHaveBeenCalledWith({
      userId: "user_1",
      displayName: "Jose",
    });
    expect(response.body).toEqual({
      ok: true,
      data: {
        shop: { name: "Nueva Barbería", slug: "niche-72" },
        user: { displayName: "Jose", email: "admin@clipper.test" },
      },
    });
  });

  it("allows profile-only updates without admin guard", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "PATCH", body: { displayName: "Jose" } }),
      response,
    );

    expect(requireAdminCapable).not.toHaveBeenCalled();
    expect(settingsRepository.updateUserDisplayName).toHaveBeenCalledWith({
      userId: "user_1",
      displayName: "Jose",
    });
  });

  it("validates non-empty patch payloads", async () => {
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(createRequest({ method: "PATCH", body: {} }), response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: expect.objectContaining({ code: "BAD_REQUEST" }),
    });
  });

  it("verifies current password and stores the hashed new password", async () => {
    const { default: handler } = await import("./password");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        body: {
          currentPassword: "old-password",
          newPassword: "new-password-12",
        },
      }),
      response,
    );

    expect(verifyPassword).toHaveBeenCalledWith("old-password", "hash_current");
    expect(hashPassword).toHaveBeenCalledWith("new-password-12");
    expect(settingsRepository.updateUserPassword).toHaveBeenCalledWith({
      userId: "user_1",
      passwordHash: "hash_new",
    });
    expect(response.body).toEqual({ ok: true, data: { updated: true } });
  });

  it("rejects incorrect current passwords", async () => {
    verifyPassword.mockResolvedValue(false);
    const { default: handler } = await import("./password");
    const response = createResponse();

    await handler(
      createRequest({
        method: "PATCH",
        body: {
          currentPassword: "wrong-password",
          newPassword: "new-password-12",
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "Current password is incorrect.",
      },
    });
  });

  it("propagates admin guard failures for shop updates", async () => {
    const { ApiError } = await import("../../src/server/api/errors");

    requireAdminCapable.mockImplementationOnce(() => {
      throw new ApiError({
        code: "FORBIDDEN",
        message: "Admin access is required.",
      });
    });
    const { default: handler } = await import("./index");
    const response = createResponse();

    await handler(
      createRequest({ method: "PATCH", body: { shopName: "Niche" } }),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(settingsRepository.updateShopName).not.toHaveBeenCalled();
  });
});
