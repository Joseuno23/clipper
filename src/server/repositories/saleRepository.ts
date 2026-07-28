import {
  CommissionMode,
  PaymentMethod,
  SaleItemKind,
  SaleStatus,
} from "../../generated/prisma/enums";
import type { Prisma } from "../../generated/prisma/client";
import { BUSINESS_TIME_ZONE } from "../../shared/lib/businessLocale";
import { ApiError } from "../api/errors";
import { prisma } from "../db/client";
import type { SaleCreateInput, SaleRepository } from "../domain/sales/types";
import {
  shopBusinessDateFromInstant,
  shopLocalDateKeyToNoonUtc,
} from "../timezone";
import {
  cancelQueueTicket,
  completePaidSaleQueueTicket,
} from "./queueLifecycle";

const saleInclude = {
  client: { select: { firstName: true, lastName: true } },
  staffMember: {
    select: { displayName: true, firstName: true, lastName: true },
  },
  appointment: {
    select: {
      id: true,
      queueStatus: true,
      client: { select: { firstName: true, lastName: true } },
    },
  },
  items: { orderBy: { createdAt: "asc" as const } },
  payments: { orderBy: { paidAt: "asc" as const } },
};

export const saleRepository: SaleRepository = {
  async list({ barberShopId, status, date, limit, offset }) {
    const dateRange = date ? saleDateRange(date) : null;
    return prisma.sale.findMany({
      where: {
        barberShopId,
        deletedAt: null,
        ...(status === "open"
          ? { status: SaleStatus.DRAFT }
          : status === "cancelled"
            ? { status: SaleStatus.CANCELLED }
            : status === "closed"
              ? { status: { in: [SaleStatus.COMPLETED, SaleStatus.REFUNDED] } }
              : {}),
        ...(dateRange
          ? { businessDate: { gte: dateRange.start, lt: dateRange.end } }
          : {}),
      },
      include: saleInclude,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: limit,
      skip: offset,
    });
  },

  async createManualDraft({ barberShopId, data, businessDate }) {
    return prisma.sale.create({
      data: {
        barberShopId,
        clientId: data.clientId ?? null,
        staffMemberId: data.staffMemberId ?? null,
        saleNumber: createSaleNumber(),
        status: SaleStatus.DRAFT,
        businessDate,
        subtotal: "0",
        discountTotal: "0",
        taxTotal: "0",
        total: "0",
      },
      include: saleInclude,
    });
  },

  async findById({ barberShopId, id }) {
    return prisma.sale.findFirst({
      where: { id, barberShopId, deletedAt: null },
      include: saleInclude,
    });
  },

  async addServiceItem({ barberShopId, saleId, serviceId, quantity }) {
    if (quantity !== 1) {
      throw new ApiError({
        code: "BAD_REQUEST",
        message: "Service sale items must have quantity 1.",
      });
    }

    return prisma.$transaction(async (transaction) => {
      const sale = await findEditableSale(transaction, {
        barberShopId,
        saleId,
      });
      if (!sale) return null;

      const service = await transaction.service.findFirst({
        where: { id: serviceId, barberShopId, deletedAt: null, isActive: true },
        select: { id: true, name: true, price: true },
      });
      if (!service) throw referenceNotFound("service");

      await transaction.saleItem.create({
        data: {
          saleId,
          barberShopId,
          kind: SaleItemKind.SERVICE,
          serviceId: service.id,
          description: service.name,
          quantity,
          unitPrice: service.price.toString(),
          total: money(Number(service.price) * quantity),
        },
      });

      await recalculateSaleTotals(transaction, { barberShopId, saleId });
      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },

  async addProductItem({ barberShopId, saleId, productId, quantity }) {
    return prisma.$transaction(async (transaction) => {
      const sale = await findEditableSale(transaction, {
        barberShopId,
        saleId,
      });
      if (!sale) return null;

      const product = await transaction.product.findFirst({
        where: { id: productId, barberShopId, deletedAt: null, isActive: true },
        select: { id: true, name: true, price: true },
      });
      if (!product) throw referenceNotFound("product");

      const existingItem = sale.items.find(
        (item) =>
          item.kind === SaleItemKind.PRODUCT && item.productId === product.id,
      );

      if (existingItem) {
        const nextQuantity = existingItem.quantity + quantity;
        await transaction.saleItem.update({
          where: { id: existingItem.id },
          data: {
            quantity: nextQuantity,
            total: money(Number(existingItem.unitPrice) * nextQuantity),
          },
        });
      } else {
        await transaction.saleItem.create({
          data: {
            saleId,
            barberShopId,
            kind: SaleItemKind.PRODUCT,
            productId: product.id,
            description: product.name,
            quantity,
            unitPrice: product.price.toString(),
            total: money(Number(product.price) * quantity),
          },
        });
      }

      await recalculateSaleTotals(transaction, { barberShopId, saleId });
      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },

  async removeItem({ barberShopId, saleId, itemId }) {
    return prisma.$transaction(async (transaction) => {
      const sale = await findEditableSale(transaction, {
        barberShopId,
        saleId,
      });
      if (!sale) return null;

      const result = await transaction.saleItem.deleteMany({
        where: { id: itemId, saleId, barberShopId },
      });
      if (result.count === 0) throw referenceNotFound("sale item");

      await recalculateSaleTotals(transaction, { barberShopId, saleId });
      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },

  async updateItemQuantity({ barberShopId, saleId, itemId, quantity }) {
    return prisma.$transaction(async (transaction) => {
      const sale = await findEditableSale(transaction, {
        barberShopId,
        saleId,
      });
      if (!sale) return null;

      const item = sale.items.find((saleItem) => saleItem.id === itemId);
      if (!item) throw referenceNotFound("sale item");
      if (item.kind !== SaleItemKind.PRODUCT) {
        throw new ApiError({
          code: "BAD_REQUEST",
          message: "Only product item quantities can be edited.",
        });
      }

      await transaction.saleItem.update({
        where: { id: item.id },
        data: {
          quantity,
          total: money(Number(item.unitPrice) * quantity),
        },
      });

      await recalculateSaleTotals(transaction, { barberShopId, saleId });
      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },

  async complete({ barberShopId, saleId, method, reference, paidAt }) {
    return prisma.$transaction(async (transaction) => {
      const sale = await findEditableSale(transaction, {
        barberShopId,
        saleId,
      });
      if (!sale) return null;
      if (sale.items.length === 0) {
        throw new ApiError({
          code: "BAD_REQUEST",
          message: "Cannot complete an empty sale.",
        });
      }

      await recalculateSaleTotals(transaction, { barberShopId, saleId });
      const freshSale = await transaction.sale.findFirstOrThrow({
        where: { id: saleId, barberShopId, deletedAt: null },
        select: { total: true },
      });

      await transaction.salePayment.create({
        data: {
          saleId,
          barberShopId,
          method,
          reference,
          amount: freshSale.total.toString(),
          paidAt,
        },
      });
      await snapshotServiceCommissions(transaction, { barberShopId, saleId });
      await transaction.sale.update({
        where: { id: saleId },
        data: { status: SaleStatus.COMPLETED, completedAt: paidAt },
      });

      if (sale.appointmentId) {
        await completePaidSaleQueueTicket(transaction, {
          barberShopId,
          appointmentId: sale.appointmentId,
        });
      }

      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },

  async cancel({ barberShopId, saleId, reason }) {
    return prisma.$transaction(async (transaction) => {
      const sale = await transaction.sale.findFirst({
        where: { id: saleId, barberShopId, deletedAt: null },
        select: { id: true, status: true, appointmentId: true },
      });
      if (!sale) return null;

      assertCancellableSale(sale.status);

      await transaction.sale.update({
        where: { id: saleId },
        data: { status: SaleStatus.CANCELLED, cancellationReason: reason },
      });

      if (sale.appointmentId) {
        await cancelQueueTicket(transaction, {
          barberShopId,
          appointmentId: sale.appointmentId,
          reason,
        });
      }

      return findSaleOrThrow(transaction, { barberShopId, saleId });
    });
  },
};

export function createSaleNumber() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(2, 14);
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `V-${stamp}-${suffix}`;
}

export async function createLinkedDraftSale(
  transaction: TransactionLike,
  input: {
    barberShopId: string;
    appointmentId: string;
    clientId: string | null;
    staffMemberId: string | null;
    businessDate: Date;
    services: Array<{
      id: string;
      name: string;
      price: { toString(): string };
    }>;
  },
) {
  const subtotal = input.services.reduce(
    (total, service) => total + Number(service.price),
    0,
  );

  await transaction.sale.create({
    data: {
      barberShopId: input.barberShopId,
      appointmentId: input.appointmentId,
      clientId: input.clientId,
      staffMemberId: input.staffMemberId,
      saleNumber: createSaleNumber(),
      status: SaleStatus.DRAFT,
      businessDate: input.businessDate,
      subtotal: money(subtotal),
      discountTotal: "0",
      taxTotal: "0",
      total: money(subtotal),
      items: {
        create: input.services.map((service) => ({
          barberShopId: input.barberShopId,
          kind: SaleItemKind.SERVICE,
          serviceId: service.id,
          description: service.name,
          quantity: 1,
          unitPrice: service.price.toString(),
          total: service.price.toString(),
        })),
      },
    },
  });
}

export async function syncDraftSaleServices(
  transaction: TransactionLike,
  input: {
    barberShopId: string;
    appointmentId: string;
    services: Array<{
      id: string;
      name: string;
      price: { toString(): string };
    }>;
  },
) {
  const sale = await transaction.sale.findFirst({
    where: {
      barberShopId: input.barberShopId,
      appointmentId: input.appointmentId,
      deletedAt: null,
      status: SaleStatus.DRAFT,
    },
    select: { id: true },
  });
  if (!sale) return;

  await transaction.saleItem.deleteMany({
    where: {
      barberShopId: input.barberShopId,
      saleId: sale.id,
      kind: SaleItemKind.SERVICE,
    },
  });
  await transaction.saleItem.createMany({
    data: input.services.map((service) => ({
      barberShopId: input.barberShopId,
      saleId: sale.id,
      kind: SaleItemKind.SERVICE,
      serviceId: service.id,
      description: service.name,
      quantity: 1,
      unitPrice: service.price.toString(),
      total: service.price.toString(),
    })),
  });
  await recalculateSaleTotals(transaction, {
    barberShopId: input.barberShopId,
    saleId: sale.id,
  });
}

type TransactionLike = typeof prisma | Prisma.TransactionClient;

async function findEditableSale(
  transaction: TransactionLike,
  input: { barberShopId: string; saleId: string },
) {
  const sale = await transaction.sale.findFirst({
    where: {
      id: input.saleId,
      barberShopId: input.barberShopId,
      deletedAt: null,
    },
    include: { items: true },
  });

  if (!sale) return null;
  if (sale.status !== SaleStatus.DRAFT) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Only draft sales can be edited.",
    });
  }
  return sale;
}

async function recalculateSaleTotals(
  transaction: TransactionLike,
  input: { barberShopId: string; saleId: string },
) {
  const items = await transaction.saleItem.findMany({
    where: { barberShopId: input.barberShopId, saleId: input.saleId },
    select: { quantity: true, unitPrice: true, discountAmount: true },
  });
  const subtotal = items.reduce(
    (total, item) => total + Number(item.unitPrice) * item.quantity,
    0,
  );
  const discountTotal = items.reduce(
    (total, item) => total + Number(item.discountAmount),
    0,
  );
  const total = Math.max(0, subtotal - discountTotal);

  await transaction.sale.update({
    where: { id: input.saleId },
    data: {
      subtotal: money(subtotal),
      discountTotal: money(discountTotal),
      taxTotal: "0",
      total: money(total),
    },
  });
}

function findSaleOrThrow(
  transaction: TransactionLike,
  input: { barberShopId: string; saleId: string },
) {
  return transaction.sale.findFirstOrThrow({
    where: {
      id: input.saleId,
      barberShopId: input.barberShopId,
      deletedAt: null,
    },
    include: saleInclude,
  });
}

function referenceNotFound(reference: string) {
  return new ApiError({
    code: "BAD_REQUEST",
    message: `Sale references an inactive or missing ${reference}.`,
  });
}

async function snapshotServiceCommissions(
  transaction: TransactionLike,
  input: { barberShopId: string; saleId: string },
) {
  const sale = await transaction.sale.findFirstOrThrow({
    where: {
      id: input.saleId,
      barberShopId: input.barberShopId,
      deletedAt: null,
    },
    select: {
      id: true,
      staffMemberId: true,
      items: {
        where: { kind: SaleItemKind.SERVICE },
        select: { id: true, serviceId: true, quantity: true, total: true },
      },
    },
  });

  if (!sale.staffMemberId) {
    await transaction.saleItem.updateMany({
      where: {
        saleId: sale.id,
        barberShopId: input.barberShopId,
        kind: SaleItemKind.SERVICE,
      },
      data: {
        commissionModeSnapshot: CommissionMode.NONE,
        commissionValueSnapshot: "0.00",
        commissionTotalSnapshot: "0.00",
      },
    });
    return;
  }

  const serviceIds = [
    ...new Set(sale.items.map((item) => item.serviceId).filter(Boolean)),
  ] as string[];
  const commissions = serviceIds.length
    ? await transaction.staffServiceCommission.findMany({
        where: {
          barberShopId: input.barberShopId,
          staffMemberId: sale.staffMemberId,
          serviceId: { in: serviceIds },
        },
        select: {
          serviceId: true,
          commissionMode: true,
          commissionValue: true,
        },
      })
    : [];
  const byService = new Map(
    commissions.map((commission) => [commission.serviceId, commission]),
  );

  for (const item of sale.items) {
    const commission = item.serviceId
      ? byService.get(item.serviceId)
      : undefined;
    const mode = commission?.commissionMode ?? CommissionMode.NONE;
    const value = Number(commission?.commissionValue ?? 0);
    const total =
      mode === CommissionMode.PERCENTAGE_BPS
        ? (Number(item.total) * value) / 10000
        : mode === CommissionMode.FIXED_AMOUNT
          ? value * item.quantity
          : 0;

    await transaction.saleItem.update({
      where: { id: item.id },
      data: {
        commissionModeSnapshot: mode,
        commissionValueSnapshot: money(value),
        commissionTotalSnapshot: money(total),
      },
    });
  }
}

function assertCancellableSale(status: SaleStatus) {
  if (status === SaleStatus.DRAFT) return;

  if (status === SaleStatus.COMPLETED) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Completed sales cannot be cancelled.",
    });
  }

  throw new ApiError({
    code: "BAD_REQUEST",
    message: "Only draft sales can be cancelled.",
  });
}

function saleDateRange(date: string) {
  const start = shopLocalDateKeyToNoonUtc(date);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export function saleBusinessDateFromInstant(
  timeZone = BUSINESS_TIME_ZONE,
  instant = new Date(),
) {
  return shopBusinessDateFromInstant(timeZone, instant);
}

function money(value: number) {
  return value.toFixed(2);
}

void PaymentMethod.TRANSFER;
