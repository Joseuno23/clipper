import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createQueueService } from "../../src/server/domain/queue/service";
import { parseQueueCreateInput } from "../../src/server/domain/queue/validation";
import { queueRepository } from "../../src/server/repositories/queueRepository";

const queueService = createQueueService(queueRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") return queueService.list(context);

    requireAdminCapable(context);
    return queueService.createWalkIn(
      context,
      parseQueueCreateInput(parseJsonBody(request)),
    );
  },
});
