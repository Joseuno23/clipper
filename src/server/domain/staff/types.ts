import type {
  CommissionMode,
  StaffRole,
} from "../../../generated/prisma/enums";

export type StaffMemberRoleRecord = {
  id: string;
  staffMemberId: string;
  barberShopId: string;
  role: StaffRole;
  createdAt: Date;
};

export type StaffRecord = {
  id: string;
  barberShopId: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  isActive: boolean;
  commissionMode: CommissionMode;
  commissionValue: { toString(): string };
  workingDays: number[];
  restDays: Date[];
  specialties: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  roles: StaffMemberRoleRecord[];
};

export type StaffDto = Omit<
  StaffRecord,
  | "barberShopId"
  | "commissionValue"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "roles"
  | "restDays"
> & {
  commissionValue: string;
  restDays: string[];
  roles: StaffRole[];
  createdAt: string;
  updatedAt: string;
};

export type StaffCreateInput = {
  userId?: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  isActive?: boolean;
  commissionMode?: CommissionMode;
  commissionValue?: number | string;
  workingDays?: Array<number | string>;
  restDays?: Array<Date | string>;
  specialties?: string[];
  roles?: StaffRole[];
};

export type StaffUpdateInput = Partial<StaffCreateInput>;

export type NormalizedStaffCreateInput = {
  userId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  isActive: boolean;
  commissionMode: CommissionMode;
  commissionValue: string;
  workingDays: number[];
  restDays: Date[];
  specialties: string[];
  roles: StaffRole[];
};

export type NormalizedStaffUpdateInput = Partial<NormalizedStaffCreateInput>;

export type StaffListInput = {
  limit?: number;
  offset?: number;
};

export type NormalizedStaffListInput = {
  limit: number;
  offset: number;
};

export type StaffRepository = {
  list(input: {
    barberShopId: string;
    pagination: NormalizedStaffListInput;
  }): Promise<StaffRecord[]>;
  create(input: {
    barberShopId: string;
    data: NormalizedStaffCreateInput;
  }): Promise<StaffRecord>;
  findActiveById(input: {
    barberShopId: string;
    id: string;
  }): Promise<StaffRecord | null>;
  update(input: {
    barberShopId: string;
    id: string;
    data: NormalizedStaffUpdateInput;
  }): Promise<StaffRecord | null>;
  softDelete(input: {
    barberShopId: string;
    id: string;
    deletedAt: Date;
  }): Promise<StaffRecord | null>;
};
