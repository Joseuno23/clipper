import { ApiError } from "../../api/errors";
import type { TenantContext, TenantRepository } from "./types";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBarberShopSlug(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;

  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw missingBarberShopSlugError();
  }

  const slug = rawValue.trim().toLowerCase();

  if (!SLUG_PATTERN.test(slug)) {
    throw invalidBarberShopSlugError();
  }

  return slug;
}

export function missingBarberShopSlugError() {
  return new ApiError({
    code: "BAD_REQUEST",
    message: "x-barbershop-slug header is required.",
  });
}

export function invalidBarberShopSlugError() {
  return new ApiError({
    code: "BAD_REQUEST",
    message: "x-barbershop-slug header must be a valid slug.",
  });
}

export function unknownOrInactiveBarberShopError(slug: string) {
  return new ApiError({
    code: "NOT_FOUND",
    message: "Barber shop was not found or is inactive.",
    details: { slug },
  });
}

export function createTenantContextService(repository: TenantRepository) {
  return {
    async resolveBySlug(value: unknown): Promise<TenantContext> {
      const slug = normalizeBarberShopSlug(value);
      const shop = await repository.findActiveBySlug(slug);

      if (!shop) {
        throw unknownOrInactiveBarberShopError(slug);
      }

      return {
        barberShopId: shop.id,
        slug: shop.slug,
        timezone: shop.timezone,
        currency: shop.currency,
      };
    },
  };
}

export type TenantContextService = ReturnType<
  typeof createTenantContextService
>;
