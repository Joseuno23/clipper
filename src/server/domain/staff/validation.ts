import { z } from "zod";

import { CommissionMode, StaffRole } from "../../../generated/prisma/enums";
import { ApiError } from "../../api/errors";
import { parseWithSchema } from "../../api/validation";
import {
  normalizeEmail,
  normalizeInteger,
  normalizeMoney,
  normalizePhone,
  normalizeText,
} from "../shared/normalization";
import type {
  NormalizedStaffCreateInput,
  NormalizedStaffListInput,
  NormalizedStaffUpdateInput,
  StaffCreateInput,
  StaffListInput,
  StaffUpdateInput,
} from "./types";

const staffCreateSchema = z.object({
  userId: z.string().nullable().optional(),
  firstName: z.string(),
  lastName: z.string(),
  displayName: z.string(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  commissionMode: z.nativeEnum(CommissionMode).optional(),
  commissionValue: z.union([z.number(), z.string()]).optional(),
  workingDays: z.array(z.union([z.number(), z.string()])).optional(),
  restDays: z.array(z.union([z.date(), z.string()])).optional(),
  specialties: z.array(z.string()).optional(),
  roles: z.array(z.nativeEnum(StaffRole)).optional(),
  serviceCommissions: z
    .array(
      z.object({
        serviceId: z.string(),
        commissionMode: z.nativeEnum(CommissionMode),
        commissionValue: z.union([z.number(), z.string()]),
      }),
    )
    .optional(),
});

const staffUpdateSchema = staffCreateSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const staffListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export function parseStaffCreateInput(input: unknown) {
  return normalizeStaffCreateInput(parseWithSchema(staffCreateSchema, input));
}

export function parseStaffUpdateInput(input: unknown) {
  return normalizeStaffUpdateInput(parseWithSchema(staffUpdateSchema, input));
}

export function parseStaffListInput(input: unknown) {
  return normalizeStaffListInput(parseWithSchema(staffListSchema, input));
}

export function normalizeStaffCreateInput(
  input: StaffCreateInput,
): NormalizedStaffCreateInput {
  const commissionMode = input.commissionMode ?? CommissionMode.NONE;

  return {
    userId: normalizeField("userId", () => normalizeText(input.userId)),
    firstName: normalizeField("firstName", () =>
      normalizeText(input.firstName, { required: true, maxLength: 120 }),
    )!,
    lastName: normalizeField("lastName", () =>
      normalizeText(input.lastName, { required: true, maxLength: 120 }),
    )!,
    displayName: normalizeField("displayName", () =>
      normalizeText(input.displayName, { required: true, maxLength: 160 }),
    )!,
    email: normalizeField("email", () => normalizeEmail(input.email)),
    normalizedEmail: normalizeField("email", () => normalizeEmail(input.email)),
    phone: normalizeField("phone", () =>
      normalizeText(input.phone, { maxLength: 40 }),
    ),
    normalizedPhone: normalizeField("phone", () => normalizePhone(input.phone)),
    isActive: input.isActive ?? true,
    commissionMode,
    commissionValue: normalizeCommissionValue(
      commissionMode,
      input.commissionValue,
    ),
    workingDays: normalizeWorkingDays(input.workingDays),
    restDays: normalizeRestDays(input.restDays),
    specialties: normalizeSpecialties(input.specialties),
    roles: normalizeRoles(input.roles),
    serviceCommissions: normalizeServiceCommissions(input.serviceCommissions),
  };
}

export function normalizeStaffUpdateInput(
  input: StaffUpdateInput,
): NormalizedStaffUpdateInput {
  const data: NormalizedStaffUpdateInput = {};

  if ("userId" in input) {
    data.userId = normalizeField("userId", () => normalizeText(input.userId));
  }
  if ("firstName" in input) {
    data.firstName = normalizeField("firstName", () =>
      normalizeText(input.firstName, { required: true, maxLength: 120 }),
    )!;
  }
  if ("lastName" in input) {
    data.lastName = normalizeField("lastName", () =>
      normalizeText(input.lastName, { required: true, maxLength: 120 }),
    )!;
  }
  if ("displayName" in input) {
    data.displayName = normalizeField("displayName", () =>
      normalizeText(input.displayName, { required: true, maxLength: 160 }),
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
  if ("isActive" in input) {
    data.isActive = input.isActive;
  }
  if ("commissionMode" in input) {
    data.commissionMode = input.commissionMode;
  }
  if ("commissionMode" in input || "commissionValue" in input) {
    data.commissionValue = normalizeCommissionValue(
      input.commissionMode,
      input.commissionValue,
    );
  }
  if ("workingDays" in input) {
    data.workingDays = normalizeWorkingDays(input.workingDays);
  }
  if ("restDays" in input) {
    data.restDays = normalizeRestDays(input.restDays);
  }
  if ("specialties" in input) {
    data.specialties = normalizeSpecialties(input.specialties);
  }
  if ("roles" in input) {
    data.roles = normalizeRoles(input.roles);
  }
  if ("serviceCommissions" in input) {
    data.serviceCommissions = normalizeServiceCommissions(
      input.serviceCommissions,
    );
  }

  return data;
}

export function normalizeStaffListInput(
  input: StaffListInput,
): NormalizedStaffListInput {
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

function normalizeCommissionValue(
  mode: CommissionMode | undefined,
  value: StaffCreateInput["commissionValue"],
) {
  return normalizeField("commissionValue", () => {
    if (mode === undefined || mode === CommissionMode.NONE) {
      return "0.00";
    }

    if (mode === CommissionMode.PERCENTAGE_BPS) {
      return normalizeInteger(value ?? 0, { min: 0, max: 10000 }).toFixed(2);
    }

    return normalizeMoney(value ?? 0, { min: 0 });
  });
}

function normalizeWorkingDays(days: StaffCreateInput["workingDays"]) {
  return Array.from(
    new Set(
      (days ?? []).map((day) =>
        normalizeField("workingDays", () =>
          normalizeInteger(day, { min: 0, max: 6 }),
        ),
      ),
    ),
  ).sort((a, b) => a - b);
}

function normalizeRestDays(days: StaffCreateInput["restDays"]) {
  return (days ?? []).map((day) =>
    normalizeField("restDays", () => {
      const date = day instanceof Date ? day : new Date(day);

      if (Number.isNaN(date.getTime())) {
        throw new Error("Date value must be valid.");
      }

      return date;
    }),
  );
}

function normalizeSpecialties(specialties: StaffCreateInput["specialties"]) {
  return Array.from(
    new Set(
      (specialties ?? [])
        .map((specialty) =>
          normalizeField("specialties", () =>
            normalizeText(specialty, { maxLength: 120 }),
          ),
        )
        .filter((specialty): specialty is string => specialty !== null),
    ),
  ).sort();
}

function normalizeRoles(roles: StaffCreateInput["roles"]) {
  return Array.from(new Set(roles ?? [])).sort();
}

function normalizeServiceCommissions(
  commissions: StaffCreateInput["serviceCommissions"],
) {
  const byService = new Map<
    string,
    NonNullable<StaffCreateInput["serviceCommissions"]>[number]
  >();

  for (const commission of commissions ?? []) {
    const serviceId = normalizeField("serviceCommissions.serviceId", () =>
      normalizeText(commission.serviceId, { required: true }),
    )!;
    byService.set(serviceId, { ...commission, serviceId });
  }

  return Array.from(byService.values())
    .map((commission) => ({
      serviceId: commission.serviceId,
      commissionMode: commission.commissionMode,
      commissionValue: normalizeCommissionValue(
        commission.commissionMode,
        commission.commissionValue,
      ),
    }))
    .sort((a, b) => a.serviceId.localeCompare(b.serviceId));
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
