// @vitest-environment node
import { jwtVerify, SignJWT } from "jose";
import { describe, expect, it } from "vitest";

import { ApiError } from "../../api/errors";
import type { AccessTokenClaims } from "./types";
import {
  DEFAULT_JWT_ACCESS_TOKEN_TTL,
  DEFAULT_JWT_AUDIENCE,
  DEFAULT_JWT_ISSUER,
  getJwtConfig,
  signAccessToken,
  verifyAccessToken,
} from "./token";

const jwtSecret = "dev-test-secret-that-is-long-enough-32";
const config = getJwtConfig({ JWT_SECRET: jwtSecret });
const claims: AccessTokenClaims = {
  sub: "user_123",
  barberShopId: "shop_72",
  barberShopSlug: "niche-72",
  role: "OWNER",
  membershipStatus: "ACTIVE",
  typ: "access",
};

describe("JWT config", () => {
  it("uses documented issuer, audience, and access-token TTL defaults", () => {
    expect(config).toEqual({
      secret: jwtSecret,
      issuer: DEFAULT_JWT_ISSUER,
      audience: DEFAULT_JWT_AUDIENCE,
      accessTokenTtl: DEFAULT_JWT_ACCESS_TOKEN_TTL,
    });
  });

  it("rejects missing or weak JWT secrets", () => {
    expect(() => getJwtConfig({})).toThrow(
      new ApiError({
        code: "INTERNAL_SERVER_ERROR",
        message: "JWT_SECRET is required.",
      }),
    );

    expect(() => getJwtConfig({ JWT_SECRET: "too-short" })).toThrow(
      "JWT_SECRET must be at least 32 characters.",
    );
  });
});

describe("access tokens", () => {
  it("signs and verifies required tenant auth claims with HS256", async () => {
    const token = await signAccessToken(claims, config);

    await expect(verifyAccessToken(token, config)).resolves.toEqual(claims);

    const verified = await jwtVerify(
      token,
      new TextEncoder().encode(jwtSecret),
      {
        issuer: DEFAULT_JWT_ISSUER,
        audience: DEFAULT_JWT_AUDIENCE,
        algorithms: ["HS256"],
      },
    );
    expect(verified.protectedHeader.alg).toBe("HS256");
  });

  it("rejects malformed tokens", async () => {
    await expect(verifyAccessToken("not-a-jwt", config)).rejects.toThrow(
      "Invalid or expired access token.",
    );
  });

  it("rejects tokens with the wrong issuer or audience", async () => {
    const token = await signAccessToken(claims, config);

    await expect(
      verifyAccessToken(token, { ...config, issuer: "other-issuer" }),
    ).rejects.toThrow("Invalid or expired access token.");

    await expect(
      verifyAccessToken(token, { ...config, audience: "other-audience" }),
    ).rejects.toThrow("Invalid or expired access token.");
  });

  it("rejects tokens signed with a disallowed algorithm", async () => {
    const token = await new SignJWT({
      barberShopId: claims.barberShopId,
      barberShopSlug: claims.barberShopSlug,
      role: claims.role,
      membershipStatus: claims.membershipStatus,
      typ: claims.typ,
    })
      .setProtectedHeader({ alg: "HS384" })
      .setSubject(claims.sub)
      .setIssuer(config.issuer)
      .setAudience(config.audience)
      .setIssuedAt()
      .setExpirationTime("2h")
      .sign(new TextEncoder().encode(jwtSecret));

    await expect(verifyAccessToken(token, config)).rejects.toThrow(
      "Invalid or expired access token.",
    );
  });

  it("rejects expired tokens", async () => {
    const token = await signAccessToken(claims, {
      ...config,
      accessTokenTtl: "1s",
    });

    await expect(
      verifyAccessToken(token, config, {
        currentDate: new Date(Date.now() + 2_000),
      }),
    ).rejects.toThrow("Invalid or expired access token.");
  });
});
