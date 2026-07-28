export type ApiEnvelope<T> =
  { ok: true; data: T } | { ok: false; error: AdminApiErrorEnvelope };

export type AdminApiErrorEnvelope = {
  code: string;
  message: string;
  details?: unknown;
};

export type ListParams = {
  limit?: number;
  offset?: number;
  query?: string;
};

export type CustomerDto = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  normalizedPhone?: string | null;
  documentNumber: string | null;
  normalizedDocument?: string | null;
  notes: string | null;
  isBlocked: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CustomerCreateInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  isBlocked?: boolean;
};

export type CustomerUpdateInput = Partial<CustomerCreateInput>;

export type StaffRole =
  "BARBER" | "STYLIST" | "COLORIST" | "ASSISTANT" | "MANAGER";

export type CommissionMode = "NONE" | "PERCENTAGE_BPS" | "FIXED_AMOUNT";

export type ServiceDto = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  basePrice: string;
  isActive: boolean;
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

export type StaffDto = {
  id: string;
  userId: string | null;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  photoDataUrl: string | null;
  isActive: boolean;
  commissionMode: CommissionMode;
  commissionValue: string;
  workingDays: number[];
  restDays: string[];
  specialties: string[];
  roles: StaffRole[];
  serviceCommissions: StaffServiceCommissionDto[];
  createdAt: string;
  updatedAt: string;
};

export type StaffServiceCommissionDto = {
  serviceId: string;
  commissionMode: CommissionMode;
  commissionValue: string;
};

export type StaffServiceCommissionInput = {
  serviceId: string;
  commissionMode: CommissionMode;
  commissionValue: number | string;
};

export type StaffCreateInput = {
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  photoDataUrl?: string | null;
  isActive?: boolean;
  commissionMode?: CommissionMode;
  commissionValue?: number | string;
  specialties?: string[];
  roles?: StaffRole[];
  serviceCommissions?: StaffServiceCommissionInput[];
};

export type StaffUpdateInput = Partial<StaffCreateInput>;

export type ProductDto = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  catalogPrice: string;
  cost: string | null;
  currentStock: number;
  stock?: number;
  lowStockAt: number | null;
  isActive: boolean;
  active?: boolean;
  category: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductCreateInput = {
  name: string;
  sku?: string | null;
  barcode?: string | null;
  description?: string | null;
  catalogPrice: number | string;
  cost?: number | string | null;
  stock: number | string;
  lowStockAt?: number | string | null;
  isActive?: boolean;
};

export type ProductUpdateInput = Partial<ProductCreateInput>;
