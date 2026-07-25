import { z } from "zod";

import { ApiError } from "../../api/errors";
import { parseWithSchema } from "../../api/validation";
import {
  normalizeDocument,
  normalizeEmail,
  normalizeInteger,
  normalizePhone,
  normalizeText,
} from "../shared/normalization";
import type {
  ClientCreateInput,
  ClientListInput,
  ClientUpdateInput,
  NormalizedClientCreateInput,
  NormalizedClientListInput,
  NormalizedClientUpdateInput,
} from "./types";

const clientCreateSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  documentNumber: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  isBlocked: z.boolean().optional(),
});

const clientUpdateSchema = clientCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const clientListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function parseClientCreateInput(input: unknown) {
  return normalizeClientCreateInput(parseWithSchema(clientCreateSchema, input));
}

export function parseClientUpdateInput(input: unknown) {
  return normalizeClientUpdateInput(parseWithSchema(clientUpdateSchema, input));
}

export function parseClientListInput(input: unknown) {
  return normalizeClientListInput(parseWithSchema(clientListSchema, input));
}

export function normalizeClientCreateInput(
  input: ClientCreateInput,
): NormalizedClientCreateInput {
  return {
    firstName: normalizeField("firstName", () =>
      normalizeText(input.firstName, { required: true, maxLength: 120 }),
    )!,
    lastName: normalizeField("lastName", () =>
      normalizeText(input.lastName, { required: true, maxLength: 120 }),
    )!,
    email: normalizeField("email", () => normalizeEmail(input.email)),
    normalizedEmail: normalizeField("email", () => normalizeEmail(input.email)),
    phone: normalizeField("phone", () =>
      normalizeText(input.phone, { maxLength: 40 }),
    ),
    normalizedPhone: normalizeField("phone", () => normalizePhone(input.phone)),
    documentNumber: normalizeField("documentNumber", () =>
      normalizeText(input.documentNumber, { maxLength: 80 }),
    ),
    normalizedDocument: normalizeField("documentNumber", () =>
      normalizeDocument(input.documentNumber),
    ),
    notes: normalizeField("notes", () =>
      normalizeText(input.notes, { maxLength: 1000 }),
    ),
    isBlocked: input.isBlocked ?? false,
  };
}

export function normalizeClientUpdateInput(
  input: ClientUpdateInput,
): NormalizedClientUpdateInput {
  const data: NormalizedClientUpdateInput = {};

  if ("firstName" in input) {
    data.firstName = normalizeField("firstName", () =>
      normalizeText(input.firstName, {
        required: true,
        maxLength: 120,
      }),
    )!;
  }

  if ("lastName" in input) {
    data.lastName = normalizeField("lastName", () =>
      normalizeText(input.lastName, {
        required: true,
        maxLength: 120,
      }),
    )!;
  }

  if ("email" in input) {
    data.email = normalizeField("email", () => normalizeEmail(input.email));
    data.normalizedEmail = data.email;
  }

  if ("phone" in input) {
    data.phone = normalizeField("phone", () =>
      normalizeText(input.phone, { maxLength: 40 }),
    );
    data.normalizedPhone = normalizeField("phone", () =>
      normalizePhone(input.phone),
    );
  }

  if ("documentNumber" in input) {
    data.documentNumber = normalizeField("documentNumber", () =>
      normalizeText(input.documentNumber, { maxLength: 80 }),
    );
    data.normalizedDocument = normalizeField("documentNumber", () =>
      normalizeDocument(input.documentNumber),
    );
  }

  if ("notes" in input) {
    data.notes = normalizeField("notes", () =>
      normalizeText(input.notes, { maxLength: 1000 }),
    );
  }

  if ("isBlocked" in input) {
    data.isBlocked = input.isBlocked;
  }

  return data;
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

export function normalizeClientListInput(
  input: ClientListInput,
): NormalizedClientListInput {
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
