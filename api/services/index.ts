import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createServiceService } from "../../src/server/domain/services/service";
import {
  parseServiceCreateInput,
  parseServiceListInput,
} from "../../src/server/domain/services/validation";
import { serviceRepository } from "../../src/server/repositories/serviceRepository";

const serviceService = createServiceService(serviceRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return serviceService.list(context, parseServiceListInput(request.query));
    }

    requireAdminCapable(context);

    return serviceService.create(
      context,
      parseServiceCreateInput(parseJsonBody(request)),
    );
  },
});
