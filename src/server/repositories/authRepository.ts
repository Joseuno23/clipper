import { UserStatus } from "../../generated/prisma/enums";
import { prisma } from "../db/client";
import type { AuthLoginCandidate, AuthRepository } from "../domain/auth/types";

const authSelection = {
  id: true,
  email: true,
  passwordHash: true,
  displayName: true,
  status: true,
  memberships: {
    where: {
      isActive: true,
      barberShop: {
        isActive: true,
        deletedAt: null,
      },
    },
    select: {
      id: true,
      role: true,
      isActive: true,
      barberShop: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          currency: true,
        },
      },
    },
    take: 1,
  },
} as const;

type RepositoryWithCurrentCandidate = AuthRepository & {
  findLoginCandidateByUserId(input: {
    userId: string;
    barberShopSlug: string;
  }): Promise<AuthLoginCandidate | null>;
};

const prismaAuthRepository: RepositoryWithCurrentCandidate = {
  async findLoginCandidate({ email, barberShopSlug }) {
    const user = await prisma.user.findFirst({
      where: {
        email,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        memberships: {
          some: {
            isActive: true,
            barberShop: {
              slug: barberShopSlug,
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        ...authSelection,
        memberships: {
          ...authSelection.memberships,
          where: {
            isActive: true,
            barberShop: {
              slug: barberShopSlug,
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
    });

    return mapAuthCandidate(user);
  },

  async findAuthContext({ userId, barberShopSlug }) {
    const candidate = await prismaAuthRepository.findLoginCandidateByUserId({
      userId,
      barberShopSlug,
    });

    if (!candidate) {
      return null;
    }

    return {
      user: {
        id: candidate.user.id,
        email: candidate.user.email,
        displayName: candidate.user.displayName,
        status: candidate.user.status,
      },
      tenant: candidate.tenant,
      membership: candidate.membership,
    };
  },

  async markLoginAt(userId, now) {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: now },
    });
  },

  async findLoginCandidateByUserId({ userId, barberShopSlug }) {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
        memberships: {
          some: {
            isActive: true,
            barberShop: {
              slug: barberShopSlug,
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
      select: {
        ...authSelection,
        memberships: {
          ...authSelection.memberships,
          where: {
            isActive: true,
            barberShop: {
              slug: barberShopSlug,
              isActive: true,
              deletedAt: null,
            },
          },
        },
      },
    });

    return mapAuthCandidate(user);
  },
};

export const authRepository: AuthRepository = prismaAuthRepository;

type AuthRepositoryUser = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  status: AuthLoginCandidate["user"]["status"];
  memberships: Array<{
    id: string;
    role: AuthLoginCandidate["membership"]["role"];
    isActive: boolean;
    barberShop: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
      currency: string;
    };
  }>;
};

function mapAuthCandidate(
  user: AuthRepositoryUser | null,
): AuthLoginCandidate | null {
  if (!user || user.memberships.length === 0) {
    return null;
  }

  const membership = user.memberships[0];
  const shop = membership.barberShop;

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      status: user.status,
      passwordHash: user.passwordHash,
    },
    tenant: {
      barberShopId: shop.id,
      name: shop.name,
      slug: shop.slug,
      timezone: shop.timezone,
      currency: shop.currency,
    },
    membership: {
      id: membership.id,
      role: membership.role,
      status: membership.isActive ? "ACTIVE" : "INACTIVE",
    },
  };
}
