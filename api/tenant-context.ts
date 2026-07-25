import { createApiHandler } from "../src/server/api/handler";
import { createTenantContextService } from "../src/server/domain/tenant/service";
import { tenantRepository } from "../src/server/repositories/tenantRepository";

const tenantContextService = createTenantContextService(tenantRepository);

export default createApiHandler({
  methods: ["GET"],
  handle: (request) =>
    tenantContextService.resolveBySlug(request.headers["x-barbershop-slug"]),
});
