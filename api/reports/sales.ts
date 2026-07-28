import { getAuthContext } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { createSalesReportService } from "../../src/server/domain/reports/sales/service";
import { parseSalesReportInput } from "../../src/server/domain/reports/sales/validation";
import { salesReportRepository } from "../../src/server/repositories/salesReportRepository";

const reportService = createSalesReportService(salesReportRepository);

export default createApiHandler({
  methods: ["GET"],
  async handle(request) {
    const context = await getAuthContext(request);
    return reportService.getReport(
      context,
      parseSalesReportInput(request.query),
    );
  },
});
