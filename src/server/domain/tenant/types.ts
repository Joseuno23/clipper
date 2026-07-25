export type TenantContext = {
  barberShopId: string;
  slug: string;
  timezone: string;
  currency: string;
};

export type TenantShopRecord = {
  id: string;
  slug: string;
  timezone: string;
  currency: string;
};

export type TenantRepository = {
  findActiveBySlug(slug: string): Promise<TenantShopRecord | null>;
};
