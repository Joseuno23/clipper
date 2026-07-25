import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parsePathId } from "../../src/server/api/params";
import { parseJsonBody } from "../../src/server/api/request";
import { createStaffService } from "../../src/server/domain/staff/service";
import { parseStaffUpdateInput } from "../../src/server/domain/staff/validation";
import { staffRepository } from "../../src/server/repositories/staffRepository";

const staffService = createStaffService(staffRepository);

export default createApiHandler({
  methods: ["GET", "PATCH", "DELETE"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "staff");

    if (method === "GET") {
      return staffService.get(context, id);
    }

    requireAdminCapable(context);

    if (method === "PATCH") {
      return staffService.update(
        context,
        id,
        parseStaffUpdateInput(parseJsonBody(request)),
      );
    }

    return staffService.delete(context, id);
  },
});
