import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createStaffService } from "../../src/server/domain/staff/service";
import {
  parseStaffCreateInput,
  parseStaffListInput,
} from "../../src/server/domain/staff/validation";
import { staffRepository } from "../../src/server/repositories/staffRepository";

const staffService = createStaffService(staffRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return staffService.list(context, parseStaffListInput(request.query));
    }

    requireAdminCapable(context);

    return staffService.create(
      context,
      parseStaffCreateInput(parseJsonBody(request)),
    );
  },
});
