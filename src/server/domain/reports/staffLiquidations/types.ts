import type { CommissionMode } from "../../../../generated/prisma/enums";

export type StaffLiquidationInput = {
  from: string;
  to: string;
  staffMemberId: string | "all";
};

export type StaffLiquidationRepositoryInput = {
  barberShopId: string;
  from: Date;
  toExclusive: Date;
  staffMemberId?: string;
};

export type StaffLiquidationSaleRecord = {
  id: string;
  saleNumber: string;
  completedAt: Date | null;
  staffMemberId: string | null;
  staffMember: {
    displayName: string;
    firstName: string;
    lastName: string;
  } | null;
  client: { firstName: string; lastName: string } | null;
  items: StaffLiquidationSaleItemRecord[];
};

export type StaffLiquidationSaleItemRecord = {
  id: string;
  serviceId: string | null;
  description: string;
  quantity: number;
  total: { toString(): string };
  commissionModeSnapshot: CommissionMode | null;
  commissionValueSnapshot: { toString(): string } | null;
  commissionTotalSnapshot: { toString(): string } | null;
};

export type StaffLiquidationRepositoryResult = {
  sales: StaffLiquidationSaleRecord[];
};

export type StaffLiquidationRepository = {
  list(
    input: StaffLiquidationRepositoryInput,
  ): Promise<StaffLiquidationRepositoryResult>;
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

export type StaffLiquidationSummaryDto = {
  staffMemberId: string;
  staffName: string;
  soldTotal: string;
  commissionTotal: string;
  orderCount: number;
  serviceLineCount: number;
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
