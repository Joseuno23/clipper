// @vitest-environment node
import type { VercelRequest } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ApiError } from "./errors";
import { parsePathId } from "./params";
import { parseWithSchema } from "./validation";

const authenticate = vi.fn();
const createAuthService = vi.fn(() => ({ authenticate }));

vi.mock("../repositories/authRepository", () => ({
  authRepository: { kind: "mock-auth-repository" },
}));

vi.mock("../domain/auth/service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../domain/auth/service")>();

  return { ...actual, createAuthService };
});

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: "GET",
    headers: {},
    query: {},
    ...overrides,
  } as VercelRequest;
}

describe("CRUD API helpers", () => {
  beforeEach(() => {
    authenticate.mockReset();
    createAuthService.mockClear();
  });

  it("resolves auth context from bearer token and shop slug", async () => {
    const authContext = { tenant: { barberShopId: "shop_1" } };
    authenticate.mockResolvedValue(authContext);
    const { getAuthContext } = await import("./auth");

    await expect(
      getAuthContext(
        createRequest({
          headers: {
            authorization: "Bearer jwt_1",
            "x-barbershop-slug": "niche-72",
          },
        }),
      ),
    ).resolves.toBe(authContext);
    expect(authenticate).toHaveBeenCalledWith({
      token: "jwt_1",
      barberShopSlug: "niche-72",
    });
  });

  it("reuses the admin-capable role guard", async () => {
    const { requireAdminCapable } = await import("./auth");

    expect(() =>
      requireAdminCapable({
        membership: { role: "STAFF" },
      } as Parameters<typeof requireAdminCapable>[0]),
    ).toThrow(
      new ApiError({ code: "FORBIDDEN", message: "Admin access is required." }),
    );
  });

  it("parses dynamic ids from query or path fallback", () => {
    expect(
      parsePathId(createRequest({ query: { id: "client_1" } }), "clients"),
    ).toBe("client_1");
    expect(
      parsePathId(createRequest({ url: "/api/clients/client_2" }), "clients"),
    ).toBe("client_2");
  });

  it("maps zod failures to safe field details", () => {
    expect(() =>
      parseWithSchema(z.object({ name: z.string() }), { name: 123 }),
    ).toThrow(ApiError);
  });
});
