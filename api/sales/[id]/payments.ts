import {
  getAuthContext,
  requireAdminCapable,
} from "../../../src/server/api/auth";
import { createApiHandler } from "../../../src/server/api/handler";
import { parsePathId } from "../../../src/server/api/params";
import { parseJsonBody } from "../../../src/server/api/request";
import { createSaleService } from "../../../src/server/domain/sales/service";
import { parseSalePaymentInput } from "../../../src/server/domain/sales/validation";
import { saleRepository } from "../../../src/server/repositories/saleRepository";

const saleService = createSaleService(saleRepository);

export default createApiHandler({
  methods: ["POST"],
  async handle(request) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "sales");

    requireAdminCapable(context);
    return saleService.complete(
      context,
      id,
      parseSalePaymentInput(parseJsonBody(request)),
    );
  },
});
