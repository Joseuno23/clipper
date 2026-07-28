import { z } from "zod";

import { QueueStatus } from "../../../generated/prisma/enums";
import { parseWithSchema } from "../../api/validation";
import { normalizeClientCreateInput } from "../clients/validation";
import type {
  QueueCancelInput,
  QueueCreateInput,
  ScheduledAppointmentCreateInput,
  QueueUpdateInput,
} from "./types";

export const liveQueuePatchStatuses = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_SERVICE,
  QueueStatus.SERVED,
  QueueStatus.LEFT,
] as const;

const createBaseSchema = z.object({
  clientId: z.string().min(1).optional(),
  serviceId: z.string().min(1).optional(),
  serviceIds: z.array(z.string().min(1)).optional(),
  staffMemberId: z.string().min(1),
  client: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("existing"), clientId: z.string().min(1) }),
      z.object({
        kind: z.literal("new"),
        firstName: z.string(),
        lastName: z.string(),
        phone: z.string().nullable().optional(),
        documentNumber: z.string().nullable().optional(),
      }),
    ])
    .optional(),
});

const createSchema = createBaseSchema
  .refine((value) => value.client || value.clientId, {
    message: "Client is required.",
  })
  .refine((value) => (value.serviceIds?.length ?? 0) > 0 || value.serviceId, {
    message: "At least one service is required.",
  });

const updateSchema = z
  .object({
    staffMemberId: z.string().min(1).optional(),
    queueStatus: z.enum(liveQueuePatchStatuses).optional(),
    positionAction: z
      .enum(["UP", "DOWN", "FIRST_WAITING", "LAST", "CHAIR"])
      .optional(),
    clientId: z.string().min(1).optional(),
    serviceIds: z.array(z.string().min(1)).optional(),
  })
  .refine(
    (value) => value.serviceIds === undefined || value.serviceIds.length > 0,
    {
      message: "At least one service is required.",
    },
  )
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required."),
});

const scheduledCreateSchema = createBaseSchema
  .extend({
    startAt: z.coerce.date(),
  })
  .refine((value) => value.client || value.clientId, {
    message: "Client is required.",
  })
  .refine((value) => (value.serviceIds?.length ?? 0) > 0 || value.serviceId, {
    message: "At least one service is required.",
  });

export function parseQueueCreateInput(input: unknown): QueueCreateInput {
  const parsed = parseWithSchema(createSchema, input);
  return normalizeQueueCreateInput(parsed);
}

export function parseScheduledAppointmentCreateInput(
  input: unknown,
): ScheduledAppointmentCreateInput {
  const parsed = parseWithSchema(scheduledCreateSchema, input);
  return {
    ...normalizeQueueCreateInput(parsed),
    startAt: parsed.startAt,
  };
}

function normalizeQueueCreateInput(
  parsed: z.infer<typeof createSchema>,
): QueueCreateInput {
  const serviceIds = uniqueServiceIds(parsed.serviceIds ?? [parsed.serviceId!]);
  const client = parsed.client ?? {
    kind: "existing" as const,
    clientId: parsed.clientId!,
  };

  if (client.kind === "existing") {
    return {
      serviceIds,
      staffMemberId: parsed.staffMemberId,
      client,
    };
  }

  const normalizedClient = normalizeClientCreateInput(client);

  return {
    serviceIds,
    staffMemberId: parsed.staffMemberId,
    client: {
      kind: "new",
      firstName: normalizedClient.firstName,
      lastName: normalizedClient.lastName,
      phone: normalizedClient.phone,
      normalizedPhone: normalizedClient.normalizedPhone,
      documentNumber: normalizedClient.documentNumber,
      normalizedDocument: normalizedClient.normalizedDocument,
    },
  };
}

function uniqueServiceIds(serviceIds: string[]) {
  return [...new Set(serviceIds)];
}

export function parseQueueUpdateInput(input: unknown): QueueUpdateInput {
  const parsed = parseWithSchema(updateSchema, input);

  return {
    ...parsed,
    ...(parsed.serviceIds === undefined
      ? {}
      : { serviceIds: uniqueServiceIds(parsed.serviceIds) }),
  };
}

export function parseQueueCancelInput(input: unknown): QueueCancelInput {
  return parseWithSchema(cancelSchema, input);
}
