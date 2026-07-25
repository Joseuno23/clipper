import { ApiError } from "../../src/server/api/errors";
import { createApiHandler } from "../../src/server/api/handler";
import { parseJsonBody } from "../../src/server/api/request";
import { createAuthService } from "../../src/server/domain/auth/service";
import { authRepository } from "../../src/server/repositories/authRepository";

const authService = createAuthService(authRepository);

export default createApiHandler({
  methods: ["POST"],
  handle: (request) =>
    authService.login(parseLoginBody(parseJsonBody(request))),
});

function parseLoginBody(body: unknown) {
  if (!isObjectBody(body)) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Login request body must be a JSON object.",
    });
  }

  const { barberShopSlug, email, password } = body;

  if (
    typeof barberShopSlug !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string"
  ) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "barberShopSlug, email, and password are required.",
    });
  }

  return { barberShopSlug, email, password };
}

function isObjectBody(body: unknown): body is Record<string, unknown> {
  return typeof body === "object" && body !== null && !Array.isArray(body);
}
