import { createApiHandler } from "../../src/server/api/handler";
import { getBearerToken } from "../../src/server/api/request";
import { createAuthService } from "../../src/server/domain/auth/service";
import { authRepository } from "../../src/server/repositories/authRepository";

const authService = createAuthService(authRepository);

export default createApiHandler({
  methods: ["GET"],
  handle: (request) =>
    authService.authenticate({
      token: getBearerToken(request.headers),
      barberShopSlug: request.headers["x-barbershop-slug"],
    }),
});
