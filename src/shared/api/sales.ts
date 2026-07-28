import { adminRequest, adminListUrl } from "./adminCrud/client";

export type SaleStatus = "DRAFT" | "COMPLETED" | "CANCELLED" | "REFUNDED";
export type SaleItemKind = "SERVICE" | "PRODUCT" | "CUSTOM";
export type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "WALLET" | "OTHER";

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

export type SaleListParams = {
  status?: "open" | "closed" | "cancelled" | "all";
  date?: string;
  limit?: number;
  offset?: number;
};

export type SaleCreateInput = {
  clientId?: string | null;
  staffMemberId?: string | null;
};
export type SaleUpdateInput =
  | { action: "addItem"; kind: "SERVICE"; serviceId: string; quantity?: number }
  | { action: "addItem"; kind: "PRODUCT"; productId: string; quantity?: number }
  | { action: "updateItemQuantity"; itemId: string; quantity: number }
  | { action: "removeItem"; itemId: string };

const SALES_PATH = "/api/sales";

export const salesKeys = {
  all: ["sales"] as const,
  list: (params: SaleListParams) => ["sales", "list", params] as const,
  detail: (id: string) => ["sales", "detail", id] as const,
};

export const salesApi = {
  list: ({
    status = "all",
    date,
    limit = 25,
    offset = 0,
  }: SaleListParams = {}) => {
    const params = new URLSearchParams({
      status,
      limit: String(limit),
      offset: String(offset),
    });
    if (date) params.set("date", date);
    return adminRequest<SaleDto[]>(
      `${adminListUrl(SALES_PATH, { query: undefined })}?${params.toString()}`,
    );
  },
  createManual: (input: SaleCreateInput = {}) =>
    adminRequest<SaleDto>(SALES_PATH, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  get: (id: string) => adminRequest<SaleDto>(`${SALES_PATH}/${id}`),
  update: (id: string, input: SaleUpdateInput) =>
    adminRequest<SaleDto>(`${SALES_PATH}/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  complete: (
    id: string,
    input: { method?: PaymentMethod; reference?: string | null } = {},
  ) =>
    adminRequest<SaleDto>(`${SALES_PATH}/${id}/payments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  cancel: (id: string, input: { reason: string }) =>
    adminRequest<SaleDto>(`${SALES_PATH}/${id}/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
};
