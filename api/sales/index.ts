import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createSaleService } from "../../src/server/domain/sales/service";
import {
  parseSaleCreateInput,
  parseSaleListInput,
} from "../../src/server/domain/sales/validation";
import { saleRepository } from "../../src/server/repositories/saleRepository";

const saleService = createSaleService(saleRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return saleService.list(context, parseSaleListInput(request.query));
    }

    requireAdminCapable(context);
    return saleService.createManualDraft(
      context,
      parseSaleCreateInput(parseJsonBody(request)),
    );
  },
});
