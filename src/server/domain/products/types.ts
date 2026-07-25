export type ProductRecord = {
  id: string;
  barberShopId: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  price: { toString(): string };
  cost: { toString(): string } | null;
  currentStock: number;
  lowStockAt: number | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ProductDto = Omit<
  ProductRecord,
  "barberShopId" | "price" | "cost" | "createdAt" | "updatedAt" | "deletedAt"
> & {
  catalogPrice: string;
  cost: string | null;
  stock: number;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductCreateInput = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  category?: string | null;
  catalogPrice: number | string;
  cost?: number | string | null;
  stock: number | string;
  lowStockAt?: number | string | null;
  isActive?: boolean;
  active?: boolean;
};

export type ProductUpdateInput = Partial<ProductCreateInput>;

export type NormalizedProductCreateInput = {
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  category: string | null;
  catalogPrice: string;
  cost: string | null;
  stock: number;
  lowStockAt: number | null;
  isActive: boolean;
};

export type NormalizedProductUpdateInput =
  Partial<NormalizedProductCreateInput>;

export type ProductListInput = {
  limit?: number;
  offset?: number;
};

export type NormalizedProductListInput = {
  limit: number;
  offset: number;
};

export type ProductRepository = {
  list(input: {
    barberShopId: string;
    pagination: NormalizedProductListInput;
  }): Promise<ProductRecord[]>;
  create(input: {
    barberShopId: string;
    data: NormalizedProductCreateInput;
  }): Promise<ProductRecord>;
  findActiveById(input: {
    barberShopId: string;
    id: string;
  }): Promise<ProductRecord | null>;
  update(input: {
    barberShopId: string;
    id: string;
    data: NormalizedProductUpdateInput;
  }): Promise<ProductRecord | null>;
  softDelete(input: {
    barberShopId: string;
    id: string;
    deletedAt: Date;
  }): Promise<ProductRecord | null>;
};
