import type { VercelRequest } from "@vercel/node";

import { getBearerToken } from "./request";
import {
  createAuthService,
  requireAdminCapable as requireAdminCapableAuth,
} from "../domain/auth/service";
import type { AuthContext } from "../domain/auth/types";
import { authRepository } from "../repositories/authRepository";

const authService = createAuthService(authRepository);

export async function getAuthContext(request: VercelRequest) {
  return authService.authenticate({
    token: getBearerToken(request.headers),
    barberShopSlug: request.headers["x-barbershop-slug"],
  });
}

export function requireAdminCapable(context: AuthContext) {
  requireAdminCapableAuth(context);
}
