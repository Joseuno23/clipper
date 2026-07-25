import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createClientService } from "../../src/server/domain/clients/service";
import {
  parseClientCreateInput,
  parseClientListInput,
} from "../../src/server/domain/clients/validation";
import { clientRepository } from "../../src/server/repositories/clientRepository";

const clientService = createClientService(clientRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return clientService.list(context, parseClientListInput(request.query));
    }

    requireAdminCapable(context);

    return clientService.create(
      context,
      parseClientCreateInput(parseJsonBody(request)),
    );
  },
});
