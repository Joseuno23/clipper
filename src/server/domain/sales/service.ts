import { PaymentMethod, SaleStatus } from "../../../generated/prisma/enums";
import { BUSINESS_TIME_ZONE } from "../../../shared/lib/businessLocale";
import { ApiError } from "../../api/errors";
import { shopBusinessDateFromInstant } from "../../timezone";
import { requireAdminCapable } from "../auth/service";
import type { AuthContext } from "../auth/types";
import type {
  SaleCreateInput,
  SaleCancelInput,
  SaleDto,
  SaleListInput,
  SalePaymentInput,
  SaleRecord,
  SaleRepository,
  SaleUpdateInput,
} from "./types";

export function createSaleService(repository: SaleRepository) {
  return {
    async list(context: AuthContext, filters: SaleListInput) {
      const records = await repository.list({
        barberShopId: context.tenant.barberShopId,
        status: filters.status ?? "all",
        date: filters.date,
        limit: filters.limit ?? 25,
        offset: filters.offset ?? 0,
      });

      return records.map(toSaleDto);
    },

    async createManualDraft(context: AuthContext, data: SaleCreateInput) {
      requireAdminCapable(context);
      return toSaleDto(
        await repository.createManualDraft({
          barberShopId: context.tenant.barberShopId,
          data,
          businessDate: shopBusinessDateFromInstant(
            context.tenant.timezone || BUSINESS_TIME_ZONE,
          ),
        }),
      );
    },

    async get(context: AuthContext, id: string) {
      const record = await repository.findById({
        barberShopId: context.tenant.barberShopId,
        id,
      });

      if (!record) throw saleNotFoundError();
      return toSaleDto(record);
    },

    async update(context: AuthContext, id: string, data: SaleUpdateInput) {
      requireAdminCapable(context);
      const barberShopId = context.tenant.barberShopId;
      const record =
        data.action === "removeItem"
          ? await repository.removeItem({
              barberShopId,
              saleId: id,
              itemId: data.itemId,
            })
          : data.action === "updateItemQuantity"
            ? await repository.updateItemQuantity({
                barberShopId,
                saleId: id,
                itemId: data.itemId,
                quantity: data.quantity,
              })
            : data.kind === "SERVICE"
              ? await addServiceItem(repository, {
                  barberShopId,
                  saleId: id,
                  serviceId: data.serviceId!,
                  quantity: data.quantity,
                })
              : await repository.addProductItem({
                  barberShopId,
                  saleId: id,
                  productId: data.productId!,
                  quantity: data.quantity ?? 1,
                });

      if (!record) throw saleNotFoundError();
      return toSaleDto(record);
    },

    async complete(
      context: AuthContext,
      id: string,
      data: SalePaymentInput,
      paidAt = new Date(),
    ) {
      requireAdminCapable(context);
      const record = await repository.complete({
        barberShopId: context.tenant.barberShopId,
        saleId: id,
        method: data.method ?? PaymentMethod.TRANSFER,
        reference: data.reference ?? null,
        paidAt,
      });

      if (!record) throw saleNotFoundError();
      return toSaleDto(record);
    },

    async cancel(context: AuthContext, id: string, data: SaleCancelInput) {
      requireAdminCapable(context);
      const record = await repository.cancel({
        barberShopId: context.tenant.barberShopId,
        saleId: id,
        reason: data.reason,
      });

      if (!record) throw saleNotFoundError();
      return toSaleDto(record);
    },
  };
}

async function addServiceItem(
  repository: SaleRepository,
  input: {
    barberShopId: string;
    saleId: string;
    serviceId: string;
    quantity?: number;
  },
) {
  if (input.quantity !== undefined && input.quantity !== 1) {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Service sale items must have quantity 1.",
    });
  }

  return repository.addServiceItem({ ...input, quantity: 1 });
}

export function toSaleDto(record: SaleRecord): SaleDto {
  const client = record.client ?? record.appointment?.client ?? null;
  const clientName = client
    ? `${client.firstName} ${client.lastName}`
    : "Venta manual";
  const staffName = record.staffMember
    ? record.staffMember.displayName ||
      `${record.staffMember.firstName} ${record.staffMember.lastName}`
    : null;

  return {
    id: record.id,
    appointmentId: record.appointmentId,
    clientId: record.clientId,
    clientName,
    staffMemberId: record.staffMemberId,
    staffName,
    number: record.saleNumber,
    status: record.status,
    statusGroup:
      record.status === SaleStatus.DRAFT
        ? "open"
        : record.status === SaleStatus.CANCELLED
          ? "cancelled"
          : "closed",
    subtotal: record.subtotal.toString(),
    discountTotal: record.discountTotal.toString(),
    taxTotal: record.taxTotal.toString(),
    total: record.total.toString(),
    businessDate: record.businessDate.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
    cancellationReason: record.cancellationReason,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    items: record.items.map((item) => ({
      id: item.id,
      kind: item.kind,
      serviceId: item.serviceId,
      productId: item.productId,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toString(),
      discountAmount: item.discountAmount.toString(),
      total: item.total.toString(),
    })),
    payments: record.payments.map((payment) => ({
      id: payment.id,
      method: payment.method,
      amount: payment.amount.toString(),
      reference: payment.reference,
      paidAt: payment.paidAt.toISOString(),
    })),
  };
}

function saleNotFoundError() {
  return new ApiError({ code: "NOT_FOUND", message: "Sale was not found." });
}
