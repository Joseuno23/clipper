import { z } from "zod";

import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { parseWithSchema } from "../../src/server/api/validation";
import { createQueueService } from "../../src/server/domain/queue/service";
import { parseScheduledAppointmentCreateInput } from "../../src/server/domain/queue/validation";
import { queueRepository } from "../../src/server/repositories/queueRepository";

const queueService = createQueueService(queueRepository);

const listQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidDateKey, "Invalid calendar date."),
});

function isValidDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return queueService.listAppointmentsByDate(
        context,
        parseWithSchema(listQuerySchema, request.query),
      );
    }

    requireAdminCapable(context);
    return queueService.createScheduledAppointment(
      context,
      parseScheduledAppointmentCreateInput(parseJsonBody(request)),
    );
  },
});
