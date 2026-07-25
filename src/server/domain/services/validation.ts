import { z } from "zod";

import { StaffRole } from "../../../generated/prisma/enums";
import { ApiError } from "../../api/errors";
import { parseWithSchema } from "../../api/validation";
import {
  normalizeInteger,
  normalizeMoney,
  normalizeText,
} from "../shared/normalization";
import type {
  NormalizedServiceCreateInput,
  NormalizedServiceListInput,
  NormalizedServiceUpdateInput,
  ServiceCreateInput,
  ServiceListInput,
  ServiceUpdateInput,
} from "./types";

const serviceCreateSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  durationMinutes: z.union([z.number(), z.string()]),
  basePrice: z.union([z.number(), z.string()]),
  allowedRoles: z.array(z.nativeEnum(StaffRole)).optional(),
});

const serviceUpdateSchema = serviceCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const serviceListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function parseServiceCreateInput(input: unknown) {
  return normalizeServiceCreateInput(
    parseWithSchema(serviceCreateSchema, input),
  );
}

export function parseServiceUpdateInput(input: unknown) {
  return normalizeServiceUpdateInput(
    parseWithSchema(serviceUpdateSchema, input),
  );
}

export function parseServiceListInput(input: unknown) {
  return normalizeServiceListInput(parseWithSchema(serviceListSchema, input));
}

export function normalizeServiceCreateInput(
  input: ServiceCreateInput,
): NormalizedServiceCreateInput {
  return {
    name: normalizeField("name", () =>
      normalizeText(input.name, { required: true, maxLength: 160 }),
    )!,
    description: normalizeField("description", () =>
      normalizeText(input.description, { maxLength: 1000 }),
    ),
    durationMinutes: normalizeField("durationMinutes", () =>
      normalizeInteger(input.durationMinutes, { min: 1 }),
    ),
    basePrice: normalizeField("basePrice", () =>
      normalizeMoney(input.basePrice, { min: 0 }),
    ),
    allowedRoles: normalizeAllowedRoles(input.allowedRoles),
  };
}

export function normalizeServiceUpdateInput(
  input: ServiceUpdateInput,
): NormalizedServiceUpdateInput {
  const data: NormalizedServiceUpdateInput = {};

  if ("name" in input) {
    data.name = normalizeField("name", () =>
      normalizeText(input.name, { required: true, maxLength: 160 }),
    )!;
  }

  if ("description" in input) {
    data.description = normalizeField("description", () =>
      normalizeText(input.description, { maxLength: 1000 }),
    );
  }

  if ("durationMinutes" in input) {
    data.durationMinutes = normalizeField("durationMinutes", () =>
      normalizeInteger(input.durationMinutes, { min: 1 }),
    );
  }

  if ("basePrice" in input) {
    data.basePrice = normalizeField("basePrice", () =>
      normalizeMoney(input.basePrice, { min: 0 }),
    );
  }

  if ("allowedRoles" in input) {
    data.allowedRoles = normalizeAllowedRoles(input.allowedRoles);
  }

  return data;
}

export function normalizeServiceListInput(
  input: ServiceListInput,
): NormalizedServiceListInput {
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

function normalizeAllowedRoles(roles: ServiceCreateInput["allowedRoles"]) {
  return Array.from(new Set(roles ?? [])).sort();
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
