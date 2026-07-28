import { SaleItemKind } from "../../../../generated/prisma/enums";
import { BUSINESS_TIME_ZONE } from "../../../../shared/lib/businessLocale";
import {
  getShopLocalDateKey,
  getShopLocalDayBoundariesForDateKey,
} from "../../../timezone";
import type { AuthContext } from "../../auth/types";
import type {
  SalesReportDayDto,
  SalesReportDto,
  SalesReportInput,
  SalesReportItemDto,
  SalesReportRepository,
} from "./types";

export function createSalesReportService(repository: SalesReportRepository) {
  return {
    async getReport(
      context: AuthContext,
      input: SalesReportInput,
    ): Promise<SalesReportDto> {
      const timeZone = context.tenant.timezone || BUSINESS_TIME_ZONE;
      const sales = await repository.list({
        barberShopId: context.tenant.barberShopId,
        from: getShopLocalDayBoundariesForDateKey(timeZone, input.from)
          .startsAt,
        toExclusive: getShopLocalDayBoundariesForDateKey(timeZone, input.to)
          .endsAt,
        itemType: input.itemType === "all" ? undefined : input.itemType,
        serviceId: input.serviceId === "all" ? undefined : input.serviceId,
        productId: input.productId === "all" ? undefined : input.productId,
      });
      const summary = {
        totalRevenue: 0,
        servicesRevenue: 0,
        productsRevenue: 0,
        orderIds: new Set<string>(),
        itemLineCount: 0,
        quantityTotal: 0,
      };
      const days = new Map<string, MutableDay>();

      for (const sale of sales) {
        if (!sale.completedAt) continue;
        const day = getDay(
          days,
          getShopLocalDateKey(timeZone, sale.completedAt),
        );
        for (const item of sale.items) {
          if (
            item.kind !== SaleItemKind.SERVICE &&
            item.kind !== SaleItemKind.PRODUCT
          )
            continue;
          const total = Number(item.total);
          const isService = item.kind === SaleItemKind.SERVICE;
          const dto: SalesReportItemDto = {
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            clientName: sale.client
              ? `${sale.client.firstName} ${sale.client.lastName}`
              : "Venta manual",
            staffName: sale.staffMember
              ? sale.staffMember.displayName ||
                `${sale.staffMember.firstName} ${sale.staffMember.lastName}`
              : null,
            itemType: item.kind,
            itemName: item.description,
            quantity: item.quantity,
            total: money(total),
          };

          summary.totalRevenue += total;
          day.totalRevenue += total;
          if (isService) {
            summary.servicesRevenue += total;
            day.servicesRevenue += total;
          } else {
            summary.productsRevenue += total;
            day.productsRevenue += total;
          }
          summary.orderIds.add(sale.id);
          day.orderIds.add(sale.id);
          summary.itemLineCount += 1;
          day.itemLineCount += 1;
          summary.quantityTotal += item.quantity;
          day.quantityTotal += item.quantity;
          day.items.push(dto);
        }
      }

      return {
        ...input,
        summary: {
          totalRevenue: money(summary.totalRevenue),
          servicesRevenue: money(summary.servicesRevenue),
          productsRevenue: money(summary.productsRevenue),
          orderCount: summary.orderIds.size,
          itemLineCount: summary.itemLineCount,
          quantityTotal: summary.quantityTotal,
        },
        days: Array.from(days.values())
          .map(toDayDto)
          .sort((a, b) => b.date.localeCompare(a.date)),
      };
    },
  };
}

type MutableDay = Omit<
  SalesReportDayDto,
  "totalRevenue" | "servicesRevenue" | "productsRevenue" | "orderCount"
> & {
  totalRevenue: number;
  servicesRevenue: number;
  productsRevenue: number;
  orderIds: Set<string>;
};

function getDay(days: Map<string, MutableDay>, date: string) {
  const existing = days.get(date);
  if (existing) return existing;
  const day: MutableDay = {
    date,
    totalRevenue: 0,
    servicesRevenue: 0,
    productsRevenue: 0,
    orderIds: new Set(),
    itemLineCount: 0,
    quantityTotal: 0,
    items: [],
  };
  days.set(date, day);
  return day;
}

function toDayDto(day: MutableDay): SalesReportDayDto {
  return {
    date: day.date,
    totalRevenue: money(day.totalRevenue),
    servicesRevenue: money(day.servicesRevenue),
    productsRevenue: money(day.productsRevenue),
    orderCount: day.orderIds.size,
    itemLineCount: day.itemLineCount,
    quantityTotal: day.quantityTotal,
    items: day.items,
  };
}

function money(value: number | string) {
  return Number(value).toFixed(2);
}
