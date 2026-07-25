// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { beforeEach, describe, expect, it, vi } from "vitest";

const findActiveBySlug = vi.fn();

vi.mock("../src/server/repositories/tenantRepository", () => ({
  tenantRepository: { findActiveBySlug },
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

describe("tenant context API handler", () => {
  beforeEach(() => {
    findActiveBySlug.mockReset();
  });

  it("returns active tenant context without auth", async () => {
    findActiveBySlug.mockResolvedValue({
      id: "shop_72",
      slug: "niche-72",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    });
    const { default: handler } = await import("./tenant-context");
    const response = createResponse();

    await handler(
      createRequest({ headers: { "x-barbershop-slug": " NICHE-72 " } }),
      response,
    );

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: {
        barberShopId: "shop_72",
        slug: "niche-72",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
    });
  });

  it("returns a typed error when the slug header is missing", async () => {
    const { default: handler } = await import("./tenant-context");
    const response = createResponse();

    await handler(createRequest(), response);

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header is required.",
      },
    });
    expect(findActiveBySlug).not.toHaveBeenCalled();
  });

  it("returns a typed error when the slug header is invalid", async () => {
    const { default: handler } = await import("./tenant-context");
    const response = createResponse();

    await handler(
      createRequest({ headers: { "x-barbershop-slug": "niche 72" } }),
      response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header must be a valid slug.",
      },
    });
    expect(findActiveBySlug).not.toHaveBeenCalled();
  });

  it("returns not found when the shop is unknown or inactive", async () => {
    findActiveBySlug.mockResolvedValue(null);
    const { default: handler } = await import("./tenant-context");
    const response = createResponse();

    await handler(
      createRequest({ headers: { "x-barbershop-slug": "inactive-shop" } }),
      response,
    );

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "NOT_FOUND",
        message: "Barber shop was not found or is inactive.",
        details: { slug: "inactive-shop" },
      },
    });
  });

  it("returns method not allowed for unsupported methods", async () => {
    const { default: handler } = await import("./tenant-context");
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
