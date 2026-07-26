import { z } from "zod";

import { QueueStatus } from "../../../generated/prisma/enums";
import { parseWithSchema } from "../../api/validation";
import type { QueueCreateInput, QueueUpdateInput } from "./types";

export const liveQueuePatchStatuses = [
  QueueStatus.WAITING,
  QueueStatus.CALLED,
  QueueStatus.IN_SERVICE,
  QueueStatus.SERVED,
  QueueStatus.LEFT,
] as const;

const createSchema = z.object({
  clientId: z.string().min(1),
  serviceId: z.string().min(1),
  staffMemberId: z.string().min(1),
});

const updateSchema = z
  .object({
    staffMemberId: z.string().min(1).optional(),
    queueStatus: z.enum(liveQueuePatchStatuses).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided.",
  });

export function parseQueueCreateInput(input: unknown): QueueCreateInput {
  return parseWithSchema(createSchema, input);
}

export function parseQueueUpdateInput(input: unknown): QueueUpdateInput {
  return parseWithSchema(updateSchema, input);
}
