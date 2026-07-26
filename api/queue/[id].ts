import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parsePathId } from "../../src/server/api/params";
import { parseJsonBody } from "../../src/server/api/request";
import { createQueueService } from "../../src/server/domain/queue/service";
import { parseQueueUpdateInput } from "../../src/server/domain/queue/validation";
import { queueRepository } from "../../src/server/repositories/queueRepository";

const queueService = createQueueService(queueRepository);

export default createApiHandler({
  methods: ["PATCH"],
  async handle(request) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "queue");

    requireAdminCapable(context);
    return queueService.updateTicket(
      context,
      id,
      parseQueueUpdateInput(parseJsonBody(request)),
    );
  },
});
