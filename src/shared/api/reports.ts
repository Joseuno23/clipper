import { adminRequest } from "./adminCrud/client";

export type StaffLiquidationSummaryDto = {
  staffMemberId: string;
  staffName: string;
  soldTotal: string;
  commissionTotal: string;
  orderCount: number;
  serviceLineCount: number;
};

export type StaffLiquidationItemDto = {
  saleId: string;
  saleNumber: string;
  clientName: string;
  serviceName: string;
  quantity: number;
  soldTotal: string;
  commissionTotal: string;
};

export type StaffLiquidationDayDto = {
  date: string;
  soldTotal: string;
  commissionTotal: string;
  orderCount: number;
  serviceLineCount: number;
  items: StaffLiquidationItemDto[];
};

export type StaffLiquidationStaffDetailDto = StaffLiquidationSummaryDto & {
  days: StaffLiquidationDayDto[];
};

export type StaffLiquidationReportDto = {
  from: string;
  to: string;
  staffMemberId: string | "all";
  summaries: StaffLiquidationSummaryDto[];
  details: StaffLiquidationStaffDetailDto[];
};

export type SalesReportItemType = "all" | "SERVICE" | "PRODUCT";

export type SalesReportItemDto = {
  saleId: string;
  saleNumber: string;
  clientName: string;
  staffName: string | null;
  itemType: "SERVICE" | "PRODUCT";
  itemName: string;
  quantity: number;
  total: string;
};

export type SalesReportDayDto = {
  date: string;
  totalRevenue: string;
  servicesRevenue: string;
  productsRevenue: string;
  orderCount: number;
  itemLineCount: number;
  quantityTotal: number;
  items: SalesReportItemDto[];
};

export type SalesReportDto = {
  from: string;
  to: string;
  itemType: SalesReportItemType;
  serviceId: string | "all";
  productId: string | "all";
  summary: {
    totalRevenue: string;
    servicesRevenue: string;
    productsRevenue: string;
    orderCount: number;
    itemLineCount: number;
    quantityTotal: number;
  };
  days: SalesReportDayDto[];
};

export type StaffLiquidationParams = {
  from: string;
  to: string;
  staffMemberId?: string | "all";
};

export type SalesReportParams = {
  from: string;
  to: string;
  itemType?: SalesReportItemType;
  serviceId?: string | "all";
  productId?: string | "all";
};

const STAFF_LIQUIDATIONS_PATH = "/api/reports/staff-liquidations";
const SALES_REPORT_PATH = "/api/reports/sales";

export const reportKeys = {
  staffLiquidations: (params: StaffLiquidationParams) =>
    ["reports", "staff-liquidations", params] as const,
  sales: (params: SalesReportParams) => ["reports", "sales", params] as const,
};

export const reportsApi = {
  staffLiquidations: ({
    from,
    to,
    staffMemberId = "all",
  }: StaffLiquidationParams) => {
    const params = new URLSearchParams({ from, to, staffMemberId });
    return adminRequest<StaffLiquidationReportDto>(
      `${STAFF_LIQUIDATIONS_PATH}?${params.toString()}`,
    );
  },
  sales: ({
    from,
    to,
    itemType = "all",
    serviceId = "all",
    productId = "all",
  }: SalesReportParams) => {
    const params = new URLSearchParams({
      from,
      to,
      itemType,
      serviceId,
      productId,
    });
    return adminRequest<SalesReportDto>(
      `${SALES_REPORT_PATH}?${params.toString()}`,
    );
  },
};
