export type Role = "SUPER_ADMIN" | "ADMIN" | "BARBER" | "SPECIALIST";

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: "starter" | "growth" | "scale";
  currency: string;
}

export interface StaffMember {
  id: string;
  name: string;
  role: Role;
  commissionPct: number;
  availableForBooking: boolean;
  avatarColor: string;
  specialties: string[];
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  blocked: boolean;
  visits: number;
  lifetimeValue: number;
  lastVisit?: Date;
  notes?: string;
}

export interface Service {
  id: string;
  name: string;
  durationMin: number;
  basePrice: number;
  active: boolean;
  allowedRoles: Role[];
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  price: number;
  stock: number;
  active: boolean;
  lowStockThreshold: number;
}

export type AppointmentStatus =
  | "scheduled"
  | "checked_in"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

export interface Appointment {
  id: string;
  customerId: string;
  staffId: string;
  serviceIds: string[];
  start: Date;
  end: Date;
  status: AppointmentStatus;
  notes?: string;
}

export type SaleStatus = "open" | "paid" | "void";
export type PaymentMethod = "cash" | "card" | "transfer" | "split";

export interface SaleItem {
  id: string;
  kind: "service" | "product";
  refId: string;
  name: string;
  qty: number;
  unitPrice: number;
}

export interface Sale {
  id: string;
  number: string;
  customerId?: string;
  staffId?: string;
  items: SaleItem[];
  status: SaleStatus;
  paymentMethod?: PaymentMethod;
  openedAt: Date;
  closedAt?: Date;
}

export interface QueueTicket {
  id: string;
  customerId: string;
  serviceId: string;
  preferredStaffId?: string;
  waitingSince: Date;
}
