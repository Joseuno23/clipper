import bcrypt from "bcryptjs";

import { prisma } from "../src/server/db/client";
import {
  BarberShopMemberRole,
  UserStatus,
} from "../src/generated/prisma/enums";

const MIN_PASSWORD_LENGTH = 12;

function readEnv(name: string, fallback?: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function requireEnv(name: string) {
  const value = readEnv(name);

  if (!value) {
    throw new Error(`${name} is required for admin seed bootstrap`);
  }

  return value;
}

const shopName = readEnv("SEED_SHOP_NAME", "Niche 72")!;
const shopSlug = readEnv("SEED_SHOP_SLUG", "niche-72")!.toLowerCase();
const shopTimezone = readEnv(
  "SEED_SHOP_TIMEZONE",
  "America/Argentina/Buenos_Aires",
)!;
const shopCurrency = readEnv("SEED_SHOP_CURRENCY", "ARS")!;
const appointmentChangeLimitSeconds = Number.parseInt(
  readEnv("SEED_APPOINTMENT_CHANGE_LIMIT_SECONDS", "86400")!,
  10,
);
const adminEmail = readEnv(
  "SEED_ADMIN_EMAIL",
  "admin@niche72.local",
)!.toLowerCase();
const adminName = readEnv("SEED_ADMIN_NAME", "Niche 72 Admin")!;
const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");

if (adminPassword.length < MIN_PASSWORD_LENGTH) {
  throw new Error(
    `SEED_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters`,
  );
}

if (
  !Number.isInteger(appointmentChangeLimitSeconds) ||
  appointmentChangeLimitSeconds < 0
) {
  throw new Error(
    "SEED_APPOINTMENT_CHANGE_LIMIT_SECONDS must be a non-negative integer",
  );
}

const passwordHash = await bcrypt.hash(adminPassword, 12);

const shop = await prisma.barberShop.upsert({
  where: { slug: shopSlug },
  create: {
    name: shopName,
    slug: shopSlug,
    timezone: shopTimezone,
    currency: shopCurrency,
    appointmentChangeLimitSeconds,
  },
  update: {
    name: shopName,
    timezone: shopTimezone,
    currency: shopCurrency,
    appointmentChangeLimitSeconds,
    isActive: true,
    deletedAt: null,
  },
});

const admin = await prisma.user.upsert({
  where: { email: adminEmail },
  create: {
    email: adminEmail,
    displayName: adminName,
    passwordHash,
    status: UserStatus.ACTIVE,
  },
  update: {
    displayName: adminName,
    passwordHash,
    status: UserStatus.ACTIVE,
    deletedAt: null,
  },
});

await prisma.barberShopMember.upsert({
  where: {
    barberShopId_userId: {
      barberShopId: shop.id,
      userId: admin.id,
    },
  },
  create: {
    barberShopId: shop.id,
    userId: admin.id,
    role: BarberShopMemberRole.OWNER,
    isActive: true,
  },
  update: {
    role: BarberShopMemberRole.OWNER,
    isActive: true,
  },
});

console.info(
  `Seeded admin ${admin.email} for shop ${shop.name} (${shop.slug}).`,
);

await prisma.$disconnect();
