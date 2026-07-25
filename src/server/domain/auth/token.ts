import { jwtVerify, SignJWT } from "jose";

import { ApiError } from "../../api/errors";
import type {
  AccessTokenClaims,
  AuthMembershipStatus,
  AuthRole,
} from "./types";

export const DEFAULT_JWT_ISSUER = "clipper";
export const DEFAULT_JWT_AUDIENCE = "clipper-web";
export const DEFAULT_JWT_ACCESS_TOKEN_TTL = "2h";
export const MIN_JWT_SECRET_LENGTH = 32;

export type JwtConfig = {
  secret: string;
  issuer: string;
  audience: string;
  accessTokenTtl: string;
};

type JwtEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    "JWT_SECRET" | "JWT_ISSUER" | "JWT_AUDIENCE" | "JWT_ACCESS_TOKEN_TTL"
  >
>;

const textEncoder = new TextEncoder();

export function getJwtConfig(env: JwtEnv = process.env): JwtConfig {
  const secret = env.JWT_SECRET?.trim();

  if (!secret) {
    throw jwtConfigError("JWT_SECRET is required.");
  }

  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw jwtConfigError(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters.`,
    );
  }

  return {
    secret,
    issuer: env.JWT_ISSUER?.trim() || DEFAULT_JWT_ISSUER,
    audience: env.JWT_AUDIENCE?.trim() || DEFAULT_JWT_AUDIENCE,
    accessTokenTtl:
      env.JWT_ACCESS_TOKEN_TTL?.trim() || DEFAULT_JWT_ACCESS_TOKEN_TTL,
  };
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  config = getJwtConfig(),
) {
  return new SignJWT({
    barberShopId: claims.barberShopId,
    barberShopSlug: claims.barberShopSlug,
    role: claims.role,
    membershipStatus: claims.membershipStatus,
    typ: claims.typ,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setIssuedAt()
    .setExpirationTime(config.accessTokenTtl)
    .sign(secretKey(config.secret));
}

export async function verifyAccessToken(
  token: string,
  config = getJwtConfig(),
  options: { currentDate?: Date } = {},
): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(config.secret), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["HS256"],
      currentDate: options.currentDate,
    });

    return parseAccessTokenClaims(payload);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Invalid or expired access token.",
    });
  }
}

function parseAccessTokenClaims(
  payload: Record<string, unknown>,
): AccessTokenClaims {
  const claims = {
    sub: payload.sub,
    barberShopId: payload.barberShopId,
    barberShopSlug: payload.barberShopSlug,
    role: payload.role,
    membershipStatus: payload.membershipStatus,
    typ: payload.typ,
  };

  if (
    typeof claims.sub !== "string" ||
    typeof claims.barberShopId !== "string" ||
    typeof claims.barberShopSlug !== "string" ||
    !isAuthRole(claims.role) ||
    !isAuthMembershipStatus(claims.membershipStatus) ||
    claims.typ !== "access"
  ) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Access token claims are invalid.",
    });
  }

  return claims as AccessTokenClaims;
}

function isAuthRole(value: unknown): value is AuthRole {
  return ["OWNER", "ADMIN", "MANAGER", "STAFF"].includes(String(value));
}

function isAuthMembershipStatus(value: unknown): value is AuthMembershipStatus {
  return value === "ACTIVE" || value === "INACTIVE";
}

function jwtConfigError(message: string) {
  return new ApiError({
    code: "INTERNAL_SERVER_ERROR",
    message,
  });
}

function secretKey(secret: string) {
  return textEncoder.encode(secret);
}
