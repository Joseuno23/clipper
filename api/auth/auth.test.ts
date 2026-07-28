// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "../../src/server/api/errors";

const login = vi.fn();
const authenticate = vi.fn();
const createAuthService = vi.fn(() => ({ login, authenticate }));

vi.mock("../../src/server/domain/auth/service", () => ({
  createAuthService,
}));

vi.mock("../../src/server/repositories/authRepository", () => ({
  authRepository: { kind: "mock-auth-repository" },
}));

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
    ...overrides,
  } as VercelRequest;
}

const safeAuthContext = {
  user: {
    id: "user_1",
    email: "admin@clipper.test",
    displayName: "Admin User",
    status: "ACTIVE",
  },
  tenant: {
    barberShopId: "shop_1",
    name: "Niche 72",
    slug: "niche-72",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
  },
  membership: {
    id: "member_1",
    role: "OWNER",
    status: "ACTIVE",
  },
  tokenClaims: {
    sub: "user_1",
    barberShopId: "shop_1",
    barberShopSlug: "niche-72",
    role: "OWNER",
    membershipStatus: "ACTIVE",
    typ: "access",
  },
};

describe("auth login API handler", () => {
  beforeEach(() => {
    login.mockReset();
    authenticate.mockReset();
    createAuthService.mockClear();
  });

  it("returns a safe login success envelope", async () => {
    login.mockResolvedValue({
      token: "jwt_1",
      ...safeAuthContext,
    });
    const { default: handler } = await import("./login");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: JSON.stringify({
          barberShopSlug: " NICHE-72 ",
          email: "ADMIN@CLIPPER.TEST",
          password: "secret-password",
        }),
      }),
      response,
    );

    expect(login).toHaveBeenCalledWith({
      barberShopSlug: " NICHE-72 ",
      email: "ADMIN@CLIPPER.TEST",
      password: "secret-password",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        token: "jwt_1",
        ...safeAuthContext,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("returns bad request for invalid login body shape", async () => {
    const { default: handler } = await import("./login");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: JSON.stringify({ email: "admin@clipper.test" }),
      }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "barberShopSlug, email, and password are required.",
      },
    });
    expect(login).not.toHaveBeenCalled();
  });

  it("maps login credential failures to generic unauthenticated errors", async () => {
    login.mockRejectedValue(
      new ApiError({
        code: "UNAUTHENTICATED",
        message: "Invalid credentials.",
      }),
    );
    const { default: handler } = await import("./login");
    const response = createResponse();

    await handler(
      createRequest({
        method: "POST",
        body: {
          barberShopSlug: "niche-72",
          email: "wrong@clipper.test",
          password: "bad-password",
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: { code: "UNAUTHENTICATED", message: "Invalid credentials." },
    });
  });

  it("returns method not allowed for unsupported login methods", async () => {
    const { default: handler } = await import("./login");
    const response = createResponse();

    await handler(createRequest({ method: "GET" }), response);

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed. Supported methods: POST",
        details: { allowedMethods: ["POST"] },
      },
    });
  });
});

describe("auth me API handler", () => {
  beforeEach(() => {
    login.mockReset();
    authenticate.mockReset();
    createAuthService.mockClear();
  });

  it("returns the current safe auth context", async () => {
    authenticate.mockResolvedValue(safeAuthContext);
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: {
          authorization: "Bearer jwt_1",
          "x-barbershop-slug": "niche-72",
        },
      }),
      response,
    );

    expect(authenticate).toHaveBeenCalledWith({
      token: "jwt_1",
      barberShopSlug: "niche-72",
    });
    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true, data: safeAuthContext });
    expect(JSON.stringify(response.body)).not.toContain("passwordHash");
  });

  it("returns unauthenticated for missing bearer token", async () => {
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: { "x-barbershop-slug": "niche-72" },
      }),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authorization Bearer token is required.",
      },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("returns unauthenticated for malformed Authorization headers", async () => {
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: {
          authorization: "Basic jwt_1",
          "x-barbershop-slug": "niche-72",
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authorization header must use Bearer token format.",
      },
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("returns bad request for missing barbershop slug header", async () => {
    authenticate.mockRejectedValue(
      new ApiError({
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header is required.",
      }),
    );
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: { authorization: "Bearer jwt_1" },
      }),
      response,
    );

    expect(authenticate).toHaveBeenCalledWith({
      token: "jwt_1",
      barberShopSlug: undefined,
    });
    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header is required.",
      },
    });
  });

  it("returns forbidden for token and slug mismatch", async () => {
    authenticate.mockRejectedValue(
      new ApiError({
        code: "FORBIDDEN",
        message: "Authenticated tenant does not match request tenant.",
      }),
    );
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: {
          authorization: "Bearer jwt_1",
          "x-barbershop-slug": "other-shop",
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "FORBIDDEN",
        message: "Authenticated tenant does not match request tenant.",
      },
    });
  });

  it("returns unauthenticated for stale or expired auth", async () => {
    authenticate.mockRejectedValue(
      new ApiError({
        code: "UNAUTHENTICATED",
        message: "Authentication is no longer valid.",
      }),
    );
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(
      createRequest({
        method: "GET",
        headers: {
          authorization: "Bearer jwt_1",
          "x-barbershop-slug": "niche-72",
        },
      }),
      response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication is no longer valid.",
      },
    });
  });

  it("returns method not allowed for unsupported me methods", async () => {
    const { default: handler } = await import("./me");
    const response = createResponse();

    await handler(createRequest({ method: "POST" }), response);

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed. Supported methods: GET",
        details: { allowedMethods: ["GET"] },
      },
    });
  });
});
