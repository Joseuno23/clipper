import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createProductService } from "../../src/server/domain/products/service";
import {
  parseProductCreateInput,
  parseProductListInput,
} from "../../src/server/domain/products/validation";
import { productRepository } from "../../src/server/repositories/productRepository";

const productService = createProductService(productRepository);

export default createApiHandler({
  methods: ["GET", "POST"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);

    if (method === "GET") {
      return productService.list(context, parseProductListInput(request.query));
    }

    requireAdminCapable(context);

    return productService.create(
      context,
      parseProductCreateInput(parseJsonBody(request)),
    );
  },
});
