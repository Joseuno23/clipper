import type { SaleItemKind } from "../../../../generated/prisma/enums";

export type SalesReportItemType = "all" | "SERVICE" | "PRODUCT";

export type SalesReportInput = {
  from: string;
  to: string;
  itemType: SalesReportItemType;
  serviceId: string | "all";
  productId: string | "all";
};

export type SalesReportRepositoryInput = {
  barberShopId: string;
  from: Date;
  toExclusive: Date;
  itemType?: Exclude<SalesReportItemType, "all">;
  serviceId?: string;
  productId?: string;
};

export type SalesReportSaleRecord = {
  id: string;
  saleNumber: string;
  completedAt: Date | null;
  client: { firstName: string; lastName: string } | null;
  staffMember: {
    displayName: string;
    firstName: string;
    lastName: string;
  } | null;
  items: SalesReportSaleItemRecord[];
};

export type SalesReportSaleItemRecord = {
  id: string;
  kind: SaleItemKind;
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  total: { toString(): string };
};

export type SalesReportRepository = {
  list(input: SalesReportRepositoryInput): Promise<SalesReportSaleRecord[]>;
};

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

export type SalesReportSummaryDto = {
  totalRevenue: string;
  servicesRevenue: string;
  productsRevenue: string;
  orderCount: number;
  itemLineCount: number;
  quantityTotal: number;
};

export type SalesReportDto = SalesReportInput & {
  summary: SalesReportSummaryDto;
  days: SalesReportDayDto[];
};
