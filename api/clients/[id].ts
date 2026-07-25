import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parsePathId } from "../../src/server/api/params";
import { parseJsonBody } from "../../src/server/api/request";
import { createClientService } from "../../src/server/domain/clients/service";
import { parseClientUpdateInput } from "../../src/server/domain/clients/validation";
import { clientRepository } from "../../src/server/repositories/clientRepository";

const clientService = createClientService(clientRepository);

export default createApiHandler({
  methods: ["GET", "PATCH", "DELETE"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "clients");

    if (method === "GET") {
      return clientService.get(context, id);
    }

    requireAdminCapable(context);

    if (method === "PATCH") {
      return clientService.update(
        context,
        id,
        parseClientUpdateInput(parseJsonBody(request)),
      );
    }

    return clientService.delete(context, id);
  },
});
