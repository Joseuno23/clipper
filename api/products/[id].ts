import { getAuthContext, requireAdminCapable } from "../../src/server/api/auth";
import { createApiHandler } from "../../src/server/api/handler";
import { parsePathId } from "../../src/server/api/params";
import { parseJsonBody } from "../../src/server/api/request";
import { createProductService } from "../../src/server/domain/products/service";
import { parseProductUpdateInput } from "../../src/server/domain/products/validation";
import { productRepository } from "../../src/server/repositories/productRepository";

const productService = createProductService(productRepository);

export default createApiHandler({
  methods: ["GET", "PATCH", "DELETE"],
  async handle(request, _response, { method }) {
    const context = await getAuthContext(request);
    const id = parsePathId(request, "products");

    if (method === "GET") {
      return productService.get(context, id);
    }

    requireAdminCapable(context);

    if (method === "PATCH") {
      return productService.update(
        context,
        id,
        parseProductUpdateInput(parseJsonBody(request)),
      );
    }

    return productService.delete(context, id);
  },
});
