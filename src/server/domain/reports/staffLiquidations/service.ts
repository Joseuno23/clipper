import { BUSINESS_TIME_ZONE } from "../../../../shared/lib/businessLocale";
import {
  getShopLocalDateKey,
  getShopLocalDayBoundariesForDateKey,
} from "../../../timezone";
import type { AuthContext } from "../../auth/types";
import type {
  StaffLiquidationDayDto,
  StaffLiquidationInput,
  StaffLiquidationItemDto,
  StaffLiquidationRepository,
  StaffLiquidationReportDto,
  StaffLiquidationSaleItemRecord,
  StaffLiquidationSaleRecord,
  StaffLiquidationStaffDetailDto,
} from "./types";

export function createStaffLiquidationService(
  repository: StaffLiquidationRepository,
) {
  return {
    async getReport(
      context: AuthContext,
      input: StaffLiquidationInput,
    ): Promise<StaffLiquidationReportDto> {
      const timeZone = context.tenant.timezone || BUSINESS_TIME_ZONE;
      const result = await repository.list({
        barberShopId: context.tenant.barberShopId,
        from: dateStart(input.from, timeZone),
        toExclusive: nextDateStart(input.to, timeZone),
        staffMemberId:
          input.staffMemberId === "all" ? undefined : input.staffMemberId,
      });

      const details = new Map<string, MutableStaffDetail>();

      for (const sale of result.sales) {
        if (!sale.staffMemberId || !sale.staffMember || !sale.completedAt)
          continue;

        const serviceItems = sale.items.filter((item) => item.serviceId);
        if (serviceItems.length === 0) continue;

        const staffDetail = getStaffDetail(details, sale);
        const saleOrderKeys = new Set<string>();

        for (const item of serviceItems) {
          const commission = Number(item.commissionTotalSnapshot ?? 0);
          const soldTotal = Number(item.total);
          const day = getDayDetail(staffDetail, sale.completedAt, timeZone);
          const dtoItem: StaffLiquidationItemDto = {
            saleId: sale.id,
            saleNumber: sale.saleNumber,
            clientName: sale.client
              ? `${sale.client.firstName} ${sale.client.lastName}`
              : "Venta manual",
            serviceName: item.description,
            quantity: item.quantity,
            soldTotal: money(soldTotal),
            commissionTotal: money(commission),
          };

          staffDetail.soldTotal += soldTotal;
          staffDetail.commissionTotal += commission;
          staffDetail.serviceLineCount += 1;
          day.soldTotal += soldTotal;
          day.commissionTotal += commission;
          day.serviceLineCount += 1;
          day.items.push(dtoItem);
          saleOrderKeys.add(day.date);
        }

        staffDetail.orderIds.add(sale.id);
        for (const date of saleOrderKeys) {
          staffDetail.days.get(date)?.orderIds.add(sale.id);
        }
      }

      const staffDetails = Array.from(details.values())
        .map(toStaffDetailDto)
        .sort((a, b) => a.staffName.localeCompare(b.staffName));

      return {
        from: input.from,
        to: input.to,
        staffMemberId: input.staffMemberId,
        summaries: staffDetails.map(({ days: _days, ...summary }) => summary),
        details: staffDetails,
      };
    },
  };
}

type MutableDayDetail = Omit<
  StaffLiquidationDayDto,
  "orderCount" | "soldTotal" | "commissionTotal"
> & {
  soldTotal: number;
  commissionTotal: number;
  orderIds: Set<string>;
};

type MutableStaffDetail = Omit<
  StaffLiquidationStaffDetailDto,
  "orderCount" | "days" | "soldTotal" | "commissionTotal"
> & {
  soldTotal: number;
  commissionTotal: number;
  orderIds: Set<string>;
  days: Map<string, MutableDayDetail>;
};

function getStaffDetail(
  details: Map<string, MutableStaffDetail>,
  sale: StaffLiquidationSaleRecord,
) {
  const existing = details.get(sale.staffMemberId!);
  if (existing) return existing;

  const staffName =
    sale.staffMember!.displayName ||
    `${sale.staffMember!.firstName} ${sale.staffMember!.lastName}`;
  const detail: MutableStaffDetail = {
    staffMemberId: sale.staffMemberId!,
    staffName,
    soldTotal: 0,
    commissionTotal: 0,
    serviceLineCount: 0,
    orderIds: new Set(),
    days: new Map(),
  };
  details.set(sale.staffMemberId!, detail);
  return detail;
}

function getDayDetail(
  detail: MutableStaffDetail,
  completedAt: Date,
  timeZone: string,
) {
  const date = getShopLocalDateKey(timeZone, completedAt);
  const existing = detail.days.get(date);
  if (existing) return existing;

  const day: MutableDayDetail = {
    date,
    soldTotal: 0,
    commissionTotal: 0,
    serviceLineCount: 0,
    orderIds: new Set(),
    items: [],
  };
  detail.days.set(date, day);
  return day;
}

function toStaffDetailDto(
  detail: MutableStaffDetail,
): StaffLiquidationStaffDetailDto {
  return {
    staffMemberId: detail.staffMemberId,
    staffName: detail.staffName,
    soldTotal: money(detail.soldTotal),
    commissionTotal: money(detail.commissionTotal),
    orderCount: detail.orderIds.size,
    serviceLineCount: detail.serviceLineCount,
    days: Array.from(detail.days.values())
      .map((day) => ({
        date: day.date,
        soldTotal: money(day.soldTotal),
        commissionTotal: money(day.commissionTotal),
        orderCount: day.orderIds.size,
        serviceLineCount: day.serviceLineCount,
        items: day.items,
      }))
      .sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function dateStart(date: string, timeZone: string) {
  return getShopLocalDayBoundariesForDateKey(timeZone, date).startsAt;
}

function nextDateStart(date: string, timeZone: string) {
  return getShopLocalDayBoundariesForDateKey(timeZone, date).endsAt;
}

function money(value: number | string) {
  return Number(value).toFixed(2);
}
