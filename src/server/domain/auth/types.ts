export type AuthRole = "OWNER" | "ADMIN" | "MANAGER" | "STAFF";

export type AuthUserStatus = "ACTIVE" | "INVITED" | "SUSPENDED" | "DISABLED";

export type AuthMembershipStatus = "ACTIVE" | "INACTIVE";

export type LoginInput = {
  barberShopSlug: string;
  email: string;
  password: string;
};

export type SafeAuthUser = {
  id: string;
  email: string;
  displayName: string;
  status: AuthUserStatus;
};

export type SafeAuthTenant = {
  barberShopId: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
};

export type SafeAuthMembership = {
  id: string;
  role: AuthRole;
  status: AuthMembershipStatus;
};

export type AccessTokenClaims = {
  sub: string;
  barberShopId: string;
  barberShopSlug: string;
  role: AuthRole;
  membershipStatus: AuthMembershipStatus;
  typ: "access";
};

export type AuthContext = {
  user: SafeAuthUser;
  tenant: SafeAuthTenant;
  membership: SafeAuthMembership;
  tokenClaims: AccessTokenClaims;
};

export type AuthContextInput = {
  token: string;
  barberShopSlug: unknown;
};

export type LoginResult = AuthContext & {
  token: string;
};

export type AuthLoginCandidate = {
  user: SafeAuthUser & { passwordHash: string };
  tenant: SafeAuthTenant;
  membership: SafeAuthMembership;
};

export type AuthRepository = {
  findLoginCandidate(input: {
    email: string;
    barberShopSlug: string;
  }): Promise<AuthLoginCandidate | null>;
  findAuthContext(input: {
    userId: string;
    barberShopSlug: string;
  }): Promise<Omit<AuthContext, "tokenClaims"> | null>;
  markLoginAt(userId: string, now: Date): Promise<void>;
};
