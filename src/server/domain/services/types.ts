import type { StaffRole } from "../../../generated/prisma/enums";

export type ServiceAllowedRoleRecord = {
  id: string;
  serviceId: string;
  barberShopId: string;
  role: StaffRole;
  staffMemberId: string | null;
  createdAt: Date;
};

export type ServiceRecord = {
  id: string;
  barberShopId: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: { toString(): string };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  allowedRoles: ServiceAllowedRoleRecord[];
};

export type ServiceDto = Omit<
  ServiceRecord,
  | "barberShopId"
  | "price"
  | "createdAt"
  | "updatedAt"
  | "deletedAt"
  | "allowedRoles"
> & {
  basePrice: string;
  allowedRoles: StaffRole[];
  createdAt: string;
  updatedAt: string;
};

export type ServiceCreateInput = {
  name: string;
  description?: string | null;
  durationMinutes: number | string;
  basePrice: number | string;
  allowedRoles?: StaffRole[];
};

export type ServiceUpdateInput = Partial<ServiceCreateInput>;

export type NormalizedServiceCreateInput = {
  name: string;
  description: string | null;
  durationMinutes: number;
  basePrice: string;
  allowedRoles: StaffRole[];
};

export type NormalizedServiceUpdateInput =
  Partial<NormalizedServiceCreateInput>;

export type ServiceListInput = {
  limit?: number;
  offset?: number;
};

export type NormalizedServiceListInput = {
  limit: number;
  offset: number;
};

export type ServiceRepository = {
  list(input: {
    barberShopId: string;
    pagination: NormalizedServiceListInput;
  }): Promise<ServiceRecord[]>;
  create(input: {
    barberShopId: string;
    data: NormalizedServiceCreateInput;
  }): Promise<ServiceRecord>;
  findActiveById(input: {
    barberShopId: string;
    id: string;
  }): Promise<ServiceRecord | null>;
  update(input: {
    barberShopId: string;
    id: string;
    data: NormalizedServiceUpdateInput;
  }): Promise<ServiceRecord | null>;
  softDelete(input: {
    barberShopId: string;
    id: string;
    deletedAt: Date;
  }): Promise<ServiceRecord | null>;
};
