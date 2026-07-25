import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parsePathId } from "../../src/server/api/params";
import { parseJsonBody } from "../../src/server/api/request";
import { createServiceService } from "../../src/server/domain/services/service";
import { parseServiceUpdateInput } from "../../src/server/domain/services/validation";
import { serviceRepository } from "../../src/server/repositories/serviceRepository";

const serviceService = createServiceService(serviceRepository);

export default createApiHandler({
  methods: ["GET", "PATCH", "DELETE"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "services");

    if (method === "GET") {
      return serviceService.get(context, id);
    }

    requireAdminCapable(context);

    if (method === "PATCH") {
      return serviceService.update(
        context,
        id,
        parseServiceUpdateInput(parseJsonBody(request)),
      );
    }

    return serviceService.delete(context, id);
  },
});
