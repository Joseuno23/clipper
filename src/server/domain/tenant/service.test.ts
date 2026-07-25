// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import { createTenantContextService, normalizeBarberShopSlug } from "./service";
import type { TenantRepository } from "./types";

function createRepository(
  findActiveBySlug: TenantRepository["findActiveBySlug"],
): TenantRepository {
  return { findActiveBySlug };
}

describe("barber shop slug normalization", () => {
  it("trims and lowercases header slugs", () => {
    expect(normalizeBarberShopSlug("  Niche-72  ")).toBe("niche-72");
  });

  it("uses the first header value when a multi-value header is received", () => {
    expect(normalizeBarberShopSlug(["NICHE-72", "other-shop"])).toBe(
      "niche-72",
    );
  });

  it("rejects missing or blank header values", () => {
    expect(() => normalizeBarberShopSlug(undefined)).toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header is required.",
      }),
    );
    expect(() => normalizeBarberShopSlug("   ")).toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header is required.",
      }),
    );
  });

  it("rejects malformed slugs", () => {
    expect(() => normalizeBarberShopSlug("niche 72")).toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "x-barbershop-slug header must be a valid slug.",
      }),
    );
  });
});

describe("tenant context service", () => {
  it("returns active shop context from a normalized slug", async () => {
    const findActiveBySlug = vi.fn(async () => ({
      id: "shop_72",
      slug: "niche-72",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    }));
    const service = createTenantContextService(
      createRepository(findActiveBySlug),
    );

    await expect(service.resolveBySlug(" NICHE-72 ")).resolves.toEqual({
      barberShopId: "shop_72",
      slug: "niche-72",
      timezone: "America/Argentina/Buenos_Aires",
      currency: "ARS",
    });
    expect(findActiveBySlug).toHaveBeenCalledWith("niche-72");
  });

  it("does not call the repository when the slug is missing", async () => {
    const findActiveBySlug = vi.fn(async () => null);
    const service = createTenantContextService(
      createRepository(findActiveBySlug),
    );

    await expect(service.resolveBySlug(" ")).rejects.toThrow(
      "x-barbershop-slug header is required.",
    );
    expect(findActiveBySlug).not.toHaveBeenCalled();
  });

  it("maps unknown or inactive shops to a typed not found error", async () => {
    const service = createTenantContextService(
      createRepository(vi.fn(async () => null)),
    );

    await expect(service.resolveBySlug("inactive-shop")).rejects.toThrow(
      new ApiError({
        code: "NOT_FOUND",
        message: "Barber shop was not found or is inactive.",
        details: { slug: "inactive-shop" },
      }),
    );
  });
});
