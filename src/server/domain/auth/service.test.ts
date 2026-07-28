// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "../../api/errors";
import {
  createAuthService,
  isAdminCapableRole,
  isStrictAdminRole,
  normalizeLoginInput,
  requireAdminCapable,
  requireStrictAdmin,
} from "./service";
import type {
  AccessTokenClaims,
  AuthContext,
  AuthLoginCandidate,
  AuthRepository,
} from "./types";

const candidate: AuthLoginCandidate = {
  user: {
    id: "user_1",
    email: "owner@example.com",
    displayName: "Owner One",
    status: "ACTIVE",
    passwordHash: "hash_1",
  },
  tenant: {
    barberShopId: "shop_1",
    name: "Niche 72",
    slug: "niche-72",
    timezone: "America/Argentina/Buenos_Aires",
    currency: "ARS",
  },
  membership: {
    id: "member_1",
    role: "OWNER",
    status: "ACTIVE",
  },
};

const claims: AccessTokenClaims = {
  sub: "user_1",
  barberShopId: "shop_1",
  barberShopSlug: "niche-72",
  role: "OWNER",
  membershipStatus: "ACTIVE",
  typ: "access",
};

function createRepository(
  overrides: Partial<AuthRepository> = {},
): AuthRepository {
  return {
    findLoginCandidate: vi.fn(async () => candidate),
    findAuthContext: vi.fn(async () => ({
      user: {
        id: candidate.user.id,
        email: candidate.user.email,
        displayName: candidate.user.displayName,
        status: candidate.user.status,
      },
      tenant: candidate.tenant,
      membership: candidate.membership,
    })),
    markLoginAt: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("login input normalization", () => {
  it("normalizes slug and email", () => {
    expect(
      normalizeLoginInput({
        barberShopSlug: " NICHE-72 ",
        email: " OWNER@EXAMPLE.COM ",
        password: "secret",
      }),
    ).toEqual({
      barberShopSlug: "niche-72",
      email: "owner@example.com",
      password: "secret",
    });
  });

  it("maps malformed login input to generic invalid credentials", () => {
    expect(() =>
      normalizeLoginInput({
        barberShopSlug: "niche 72",
        email: "not-email",
        password: " ",
      }),
    ).toThrow(
      new ApiError({
        code: "UNAUTHENTICATED",
        message: "Invalid credentials.",
      }),
    );
  });
});

describe("auth login service", () => {
  it("returns a token and safe auth context for active credentials", async () => {
    const repository = createRepository();
    const signToken = vi.fn(async () => "jwt_1");
    const service = createAuthService(repository, {
      signToken,
      verifyPassword: vi.fn(async () => true),
      now: () => new Date("2026-07-25T00:00:00.000Z"),
    });

    await expect(
      service.login({
        barberShopSlug: " NICHE-72 ",
        email: " OWNER@EXAMPLE.COM ",
        password: "secret",
      }),
    ).resolves.toEqual({
      token: "jwt_1",
      user: {
        id: "user_1",
        email: "owner@example.com",
        displayName: "Owner One",
        status: "ACTIVE",
      },
      tenant: candidate.tenant,
      membership: candidate.membership,
      tokenClaims: claims,
    });
    expect(repository.findLoginCandidate).toHaveBeenCalledWith({
      barberShopSlug: "niche-72",
      email: "owner@example.com",
      password: "secret",
    });
    expect(repository.markLoginAt).toHaveBeenCalledWith(
      "user_1",
      new Date("2026-07-25T00:00:00.000Z"),
    );
    expect(signToken).toHaveBeenCalledWith(claims);
  });

  it("uses generic invalid credentials for unknown or inactive candidates", async () => {
    const service = createAuthService(
      createRepository({ findLoginCandidate: vi.fn(async () => null) }),
      { verifyPassword: vi.fn(async () => true) },
    );

    await expect(
      service.login({
        barberShopSlug: "niche-72",
        email: "owner@example.com",
        password: "secret",
      }),
    ).rejects.toThrow("Invalid credentials.");
  });

  it("uses generic invalid credentials for wrong passwords", async () => {
    const service = createAuthService(createRepository(), {
      verifyPassword: vi.fn(async () => false),
    });

    await expect(
      service.login({
        barberShopSlug: "niche-72",
        email: "owner@example.com",
        password: "wrong",
      }),
    ).rejects.toThrow("Invalid credentials.");
  });
});

describe("auth context service", () => {
  it("verifies token, checks slug coherence, and re-reads current DB state", async () => {
    const repository = createRepository();
    const service = createAuthService(repository, {
      verifyToken: vi.fn(async () => claims),
    });

    await expect(
      service.authenticate({ token: "jwt_1", barberShopSlug: "NICHE-72" }),
    ).resolves.toEqual({
      user: {
        id: "user_1",
        email: "owner@example.com",
        displayName: "Owner One",
        status: "ACTIVE",
      },
      tenant: candidate.tenant,
      membership: candidate.membership,
      tokenClaims: claims,
    });
    expect(repository.findAuthContext).toHaveBeenCalledWith({
      userId: "user_1",
      barberShopSlug: "niche-72",
    });
  });

  it("rejects token and header slug mismatch", async () => {
    const service = createAuthService(createRepository(), {
      verifyToken: vi.fn(async () => claims),
    });

    await expect(
      service.authenticate({ token: "jwt_1", barberShopSlug: "other-shop" }),
    ).rejects.toThrow("Authenticated tenant does not match request tenant.");
  });

  it("rejects stale tokens when current DB state is missing", async () => {
    const service = createAuthService(
      createRepository({ findAuthContext: vi.fn(async () => null) }),
      { verifyToken: vi.fn(async () => claims) },
    );

    await expect(
      service.authenticate({ token: "jwt_1", barberShopSlug: "niche-72" }),
    ).rejects.toThrow("Authentication is no longer valid.");
  });

  it("rejects stale tokens when role or membership status changed", async () => {
    const changedContext: Omit<AuthContext, "tokenClaims"> = {
      user: {
        id: "user_1",
        email: "owner@example.com",
        displayName: "Owner One",
        status: "ACTIVE",
      },
      tenant: candidate.tenant,
      membership: { ...candidate.membership, role: "STAFF" },
    };
    const service = createAuthService(
      createRepository({ findAuthContext: vi.fn(async () => changedContext) }),
      { verifyToken: vi.fn(async () => claims) },
    );

    await expect(
      service.authenticate({ token: "jwt_1", barberShopSlug: "niche-72" }),
    ).rejects.toThrow("Authentication is no longer valid.");
  });
});

describe("auth role helpers", () => {
  it("treats only OWNER and ADMIN as admin-capable", () => {
    expect(isAdminCapableRole("OWNER")).toBe(true);
    expect(isAdminCapableRole("ADMIN")).toBe(true);
    expect(isAdminCapableRole("MANAGER")).toBe(false);
    expect(isAdminCapableRole("STAFF")).toBe(false);
  });

  it("treats only ADMIN as strict admin", () => {
    expect(isStrictAdminRole("ADMIN")).toBe(true);
    expect(isStrictAdminRole("OWNER")).toBe(false);
    expect(isStrictAdminRole("MANAGER")).toBe(false);
    expect(isStrictAdminRole("STAFF")).toBe(false);
  });

  it("allows OWNER through admin-capable checks but not strict admin checks", () => {
    const ownerContext: AuthContext = {
      user: {
        id: "user_1",
        email: "owner@example.com",
        displayName: "Owner One",
        status: "ACTIVE",
      },
      tenant: candidate.tenant,
      membership: candidate.membership,
      tokenClaims: claims,
    };

    expect(() => requireAdminCapable(ownerContext)).not.toThrow();
    expect(() => requireStrictAdmin(ownerContext)).toThrow(
      "Strict admin access is required.",
    );
  });

  it("allows ADMIN through both admin-capable and strict admin checks", () => {
    const adminContext: AuthContext = {
      user: {
        id: "user_2",
        email: "admin@example.com",
        displayName: "Admin One",
        status: "ACTIVE",
      },
      tenant: candidate.tenant,
      membership: { ...candidate.membership, role: "ADMIN" },
      tokenClaims: { ...claims, sub: "user_2", role: "ADMIN" },
    };

    expect(() => requireAdminCapable(adminContext)).not.toThrow();
    expect(() => requireStrictAdmin(adminContext)).not.toThrow();
  });

  it("throws a typed forbidden error for non-admin roles", () => {
    expect(() =>
      requireAdminCapable({
        user: {
          id: "user_1",
          email: "owner@example.com",
          displayName: "Owner One",
          status: "ACTIVE",
        },
        tenant: candidate.tenant,
        membership: { ...candidate.membership, role: "STAFF" },
        tokenClaims: { ...claims, role: "STAFF" },
      }),
    ).toThrow("Admin access is required.");
  });

  it("throws a typed forbidden error for non-strict admin roles", () => {
    expect(() =>
      requireStrictAdmin({
        user: {
          id: "user_1",
          email: "owner@example.com",
          displayName: "Owner One",
          status: "ACTIVE",
        },
        tenant: candidate.tenant,
        membership: candidate.membership,
        tokenClaims: claims,
      }),
    ).toThrow("Strict admin access is required.");
  });
});
