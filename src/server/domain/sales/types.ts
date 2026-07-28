import type {
  PaymentMethod,
  SaleItemKind,
  SaleStatus,
} from "../../../generated/prisma/enums";

export type SaleRecord = {
  id: string;
  appointmentId: string | null;
  clientId: string | null;
  staffMemberId: string | null;
  saleNumber: string;
  status: SaleStatus;
  subtotal: { toString(): string };
  discountTotal: { toString(): string };
  taxTotal: { toString(): string };
  total: { toString(): string };
  businessDate: Date;
  completedAt: Date | null;
  cancellationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { firstName: string; lastName: string } | null;
  staffMember: {
    displayName: string;
    firstName: string;
    lastName: string;
  } | null;
  appointment: {
    id: string;
    queueStatus: string;
    client: { firstName: string; lastName: string } | null;
  } | null;
  items: SaleItemRecord[];
  payments: SalePaymentRecord[];
};

export type SaleItemRecord = {
  id: string;
  kind: SaleItemKind;
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: { toString(): string };
  discountAmount: { toString(): string };
  total: { toString(): string };
};

export type SalePaymentRecord = {
  id: string;
  method: PaymentMethod;
  amount: { toString(): string };
  reference: string | null;
  paidAt: Date;
};

export type SaleDto = {
  id: string;
  appointmentId: string | null;
  clientId: string | null;
  clientName: string;
  staffMemberId: string | null;
  staffName: string | null;
  number: string;
  status: SaleStatus;
  statusGroup: "open" | "closed" | "cancelled";
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  businessDate: string;
  completedAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
  items: SaleItemDto[];
  payments: SalePaymentDto[];
};

export type SaleItemDto = {
  id: string;
  kind: SaleItemKind;
  serviceId: string | null;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: string;
  discountAmount: string;
  total: string;
};

export type SalePaymentDto = {
  id: string;
  method: PaymentMethod;
  amount: string;
  reference: string | null;
  paidAt: string;
};

export type SaleListInput = {
  status?: "open" | "closed" | "cancelled" | "all";
  date?: string;
  limit?: number;
  offset?: number;
};
export type SaleCreateInput = {
  clientId?: string | null;
  staffMemberId?: string | null;
};
export type SaleAddItemInput = {
  action: "addItem";
  kind: "SERVICE" | "PRODUCT";
  serviceId?: string;
  productId?: string;
  quantity?: number;
};
export type SaleUpdateItemQuantityInput = {
  action: "updateItemQuantity";
  itemId: string;
  quantity: number;
};
export type SaleRemoveItemInput = { action: "removeItem"; itemId: string };
export type SaleUpdateInput =
  SaleAddItemInput | SaleUpdateItemQuantityInput | SaleRemoveItemInput;
export type SalePaymentInput = {
  method?: PaymentMethod;
  reference?: string | null;
};
export type SaleCancelInput = { reason: string };

export type SaleRepository = {
  list(input: {
    barberShopId: string;
    status?: SaleListInput["status"];
    date?: string;
    limit: number;
    offset: number;
  }): Promise<SaleRecord[]>;
  createManualDraft(input: {
    barberShopId: string;
    data: SaleCreateInput;
    businessDate: Date;
  }): Promise<SaleRecord>;
  findById(input: {
    barberShopId: string;
    id: string;
  }): Promise<SaleRecord | null>;
  addServiceItem(input: {
    barberShopId: string;
    saleId: string;
    serviceId: string;
    quantity: number;
  }): Promise<SaleRecord | null>;
  addProductItem(input: {
    barberShopId: string;
    saleId: string;
    productId: string;
    quantity: number;
  }): Promise<SaleRecord | null>;
  removeItem(input: {
    barberShopId: string;
    saleId: string;
    itemId: string;
  }): Promise<SaleRecord | null>;
  updateItemQuantity(input: {
    barberShopId: string;
    saleId: string;
    itemId: string;
    quantity: number;
  }): Promise<SaleRecord | null>;
  complete(input: {
    barberShopId: string;
    saleId: string;
    method: PaymentMethod;
    reference: string | null;
    paidAt: Date;
  }): Promise<SaleRecord | null>;
  cancel(input: {
    barberShopId: string;
    saleId: string;
    reason: string;
  }): Promise<SaleRecord | null>;
};
