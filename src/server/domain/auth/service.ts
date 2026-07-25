import { ApiError } from "../../api/errors";
import { normalizeBarberShopSlug } from "../tenant/service";
import { verifyPassword as verifyPasswordHash } from "./password";
import { signAccessToken, verifyAccessToken } from "./token";
import type {
  AccessTokenClaims,
  AuthContext,
  AuthContextInput,
  AuthRepository,
  AuthRole,
  LoginInput,
  LoginResult,
} from "./types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthServiceOptions = {
  signToken?: typeof signAccessToken;
  verifyToken?: typeof verifyAccessToken;
  verifyPassword?: typeof verifyPasswordHash;
  now?: () => Date;
};

export function createAuthService(
  repository: AuthRepository,
  options: AuthServiceOptions = {},
) {
  const signToken = options.signToken ?? signAccessToken;
  const verifyToken = options.verifyToken ?? verifyAccessToken;
  const verifyPassword = options.verifyPassword ?? verifyPasswordHash;
  const now = options.now ?? (() => new Date());

  return {
    async login(input: LoginInput): Promise<LoginResult> {
      const normalizedInput = normalizeLoginInput(input);
      const candidate = await repository.findLoginCandidate(normalizedInput);

      if (!candidate) {
        throw invalidCredentialsError();
      }

      const passwordMatches = await verifyPassword(
        normalizedInput.password,
        candidate.user.passwordHash,
      );

      if (!passwordMatches) {
        throw invalidCredentialsError();
      }

      const tokenClaims: AccessTokenClaims = {
        sub: candidate.user.id,
        barberShopId: candidate.tenant.barberShopId,
        barberShopSlug: candidate.tenant.slug,
        role: candidate.membership.role,
        membershipStatus: candidate.membership.status,
        typ: "access",
      };
      const token = await signToken(tokenClaims);

      await repository.markLoginAt(candidate.user.id, now());

      return {
        token,
        user: stripPasswordHash(candidate.user),
        tenant: candidate.tenant,
        membership: candidate.membership,
        tokenClaims,
      };
    },

    async authenticate(input: AuthContextInput): Promise<AuthContext> {
      const headerSlug = normalizeBarberShopSlug(input.barberShopSlug);
      const tokenClaims = await verifyToken(input.token);

      if (tokenClaims.barberShopSlug !== headerSlug) {
        throw tenantMismatchError();
      }

      const currentContext = await repository.findAuthContext({
        userId: tokenClaims.sub,
        barberShopSlug: headerSlug,
      });

      if (!currentContext) {
        throw invalidTokenStateError();
      }

      if (
        currentContext.tenant.barberShopId !== tokenClaims.barberShopId ||
        currentContext.membership.role !== tokenClaims.role ||
        currentContext.membership.status !== tokenClaims.membershipStatus
      ) {
        throw invalidTokenStateError();
      }

      return {
        ...currentContext,
        tokenClaims,
      };
    },
  };
}

export type AuthService = ReturnType<typeof createAuthService>;

export function normalizeLoginInput(input: LoginInput) {
  let barberShopSlug: string;

  try {
    barberShopSlug = normalizeBarberShopSlug(input.barberShopSlug);
  } catch {
    throw invalidCredentialsError();
  }

  const email = input.email.trim().toLowerCase();
  const password = input.password;

  if (!EMAIL_PATTERN.test(email) || password.trim() === "") {
    throw invalidCredentialsError();
  }

  return { barberShopSlug, email, password };
}

export function isAdminCapableRole(role: AuthRole) {
  return role === "OWNER" || role === "ADMIN";
}

export function isStrictAdminRole(role: AuthRole) {
  return role === "ADMIN";
}

export function requireAdminCapable(context: AuthContext) {
  if (!isAdminCapableRole(context.membership.role)) {
    throw new ApiError({
      code: "FORBIDDEN",
      message: "Admin access is required.",
    });
  }
}

export function requireStrictAdmin(context: AuthContext) {
  if (!isStrictAdminRole(context.membership.role)) {
    throw new ApiError({
      code: "FORBIDDEN",
      message: "Strict admin access is required.",
    });
  }
}

export function invalidCredentialsError() {
  return new ApiError({
    code: "UNAUTHENTICATED",
    message: "Invalid credentials.",
  });
}

function tenantMismatchError() {
  return new ApiError({
    code: "FORBIDDEN",
    message: "Authenticated tenant does not match request tenant.",
  });
}

function invalidTokenStateError() {
  return new ApiError({
    code: "UNAUTHENTICATED",
    message: "Authentication is no longer valid.",
  });
}

function stripPasswordHash<T extends { passwordHash: string }>(user: T) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
