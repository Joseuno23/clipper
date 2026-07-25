import { z } from "zod";

import { ApiError } from "../../api/errors";
import { parseWithSchema } from "../../api/validation";
import {
  normalizeInteger,
  normalizeMoney,
  normalizeText,
} from "../shared/normalization";
import type {
  NormalizedProductCreateInput,
  NormalizedProductListInput,
  NormalizedProductUpdateInput,
  ProductCreateInput,
  ProductListInput,
  ProductUpdateInput,
} from "./types";

const productCreateSchema = z.object({
  name: z.string(),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  catalogPrice: z.union([z.number(), z.string()]),
  cost: z.union([z.number(), z.string()]).nullable().optional(),
  stock: z.union([z.number(), z.string()]),
  lowStockAt: z.union([z.number(), z.string()]).nullable().optional(),
  isActive: z.boolean().optional(),
  active: z.boolean().optional(),
});

const productUpdateSchema = productCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const productListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function parseProductCreateInput(input: unknown) {
  return normalizeProductCreateInput(
    parseWithSchema(productCreateSchema, input),
  );
}

export function parseProductUpdateInput(input: unknown) {
  return normalizeProductUpdateInput(
    parseWithSchema(productUpdateSchema, input),
  );
}

export function parseProductListInput(input: unknown) {
  return normalizeProductListInput(parseWithSchema(productListSchema, input));
}

export function normalizeProductCreateInput(
  input: ProductCreateInput,
): NormalizedProductCreateInput {
  return {
    name: normalizeField("name", () =>
      normalizeText(input.name, { required: true, maxLength: 160 }),
    )!,
    sku: normalizeCode("sku", input.sku),
    barcode: normalizeCode("barcode", input.barcode),
    description: normalizeField("description", () =>
      normalizeText(input.description, { maxLength: 1000 }),
    ),
    category: normalizeField("category", () =>
      normalizeText(input.category, { maxLength: 120 }),
    ),
    catalogPrice: normalizeField("catalogPrice", () =>
      normalizeMoney(input.catalogPrice, { min: 0 }),
    ),
    cost: normalizeOptionalMoney("cost", input.cost),
    stock: normalizeField("stock", () =>
      normalizeInteger(input.stock, { min: 0 }),
    ),
    lowStockAt: normalizeOptionalInteger("lowStockAt", input.lowStockAt),
    isActive: input.isActive ?? input.active ?? true,
  };
}

export function normalizeProductUpdateInput(
  input: ProductUpdateInput,
): NormalizedProductUpdateInput {
  const data: NormalizedProductUpdateInput = {};

  if ("name" in input) {
    data.name = normalizeField("name", () =>
      normalizeText(input.name, { required: true, maxLength: 160 }),
    )!;
  }
  if ("sku" in input) data.sku = normalizeCode("sku", input.sku);
  if ("barcode" in input) {
    data.barcode = normalizeCode("barcode", input.barcode);
  }
  if ("description" in input) {
    data.description = normalizeField("description", () =>
      normalizeText(input.description, { maxLength: 1000 }),
    );
  }
  if ("category" in input) {
    data.category = normalizeField("category", () =>
      normalizeText(input.category, { maxLength: 120 }),
    );
  }
  if ("catalogPrice" in input) {
    data.catalogPrice = normalizeField("catalogPrice", () =>
      normalizeMoney(input.catalogPrice, { min: 0 }),
    );
  }
  if ("cost" in input) data.cost = normalizeOptionalMoney("cost", input.cost);
  if ("stock" in input) {
    data.stock = normalizeField("stock", () =>
      normalizeInteger(input.stock, { min: 0 }),
    );
  }
  if ("lowStockAt" in input) {
    data.lowStockAt = normalizeOptionalInteger("lowStockAt", input.lowStockAt);
  }
  if ("isActive" in input) data.isActive = input.isActive;
  if ("active" in input) data.isActive = input.active;

  return data;
}

export function normalizeProductListInput(
  input: ProductListInput,
): NormalizedProductListInput {
  return {
    limit:
      input.limit === undefined
        ? 50
        : normalizeInteger(input.limit, { min: 1, max: 100 }),
    offset:
      input.offset === undefined
        ? 0
        : normalizeInteger(input.offset, { min: 0 }),
  };
}

function normalizeCode(field: string, value: unknown) {
  return normalizeField(
    field,
    () => normalizeText(value, { maxLength: 120 })?.toUpperCase() ?? null,
  );
}

function normalizeOptionalMoney(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeField(field, () => normalizeMoney(value, { min: 0 }));
}

function normalizeOptionalInteger(field: string, value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return normalizeField(field, () => normalizeInteger(value, { min: 0 }));
}

function normalizeField<T>(field: string, normalize: () => T): T {
  try {
    return normalize();
  } catch (error) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Request validation failed.",
      details: {
        fields: [
          {
            field,
            message: error instanceof Error ? error.message : "Invalid value.",
          },
        ],
      },
    });
  }
}
