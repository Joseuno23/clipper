import {
  getAuthContext,
  requireAdminCapable,
} from "../../../src/server/api/auth";
import { createApiHandler } from "../../../src/server/api/handler";
import { parsePathId } from "../../../src/server/api/params";
import { parseJsonBody } from "../../../src/server/api/request";
import { createQueueService } from "../../../src/server/domain/queue/service";
import { parseQueueCancelInput } from "../../../src/server/domain/queue/validation";
import { queueRepository } from "../../../src/server/repositories/queueRepository";

const queueService = createQueueService(queueRepository);

export default createApiHandler({
  methods: ["POST"],
  async handle(request) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "queue");

    requireAdminCapable(context);
    return queueService.cancelTicket(
      context,
      id,
      parseQueueCancelInput(parseJsonBody(request)),
    );
  },
});
