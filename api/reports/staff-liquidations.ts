import { getAuthContext } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { createStaffLiquidationService } from "../../src/server/domain/reports/staffLiquidations/service";
import { parseStaffLiquidationInput } from "../../src/server/domain/reports/staffLiquidations/validation";
import { staffLiquidationRepository } from "../../src/server/repositories/staffLiquidationRepository";

const reportService = createStaffLiquidationService(staffLiquidationRepository);

export default createApiHandler({
  methods: ["GET"],
  async handle(request) {
    const context = await getAuthContext(request);
    return reportService.getReport(
      context,
      parseStaffLiquidationInput(request.query),
    );
  },
});
