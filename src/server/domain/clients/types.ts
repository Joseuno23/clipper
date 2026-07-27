export type ClientRecord = {
  id: string;
  barberShopId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  documentNumber: string | null;
  normalizedDocument: string | null;
  notes: string | null;
  isBlocked: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type ClientDto = Omit<
  ClientRecord,
  "barberShopId" | "createdAt" | "updatedAt" | "deletedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

export type ClientCreateInput = {
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  documentNumber?: string | null;
  notes?: string | null;
  isBlocked?: boolean;
};

export type ClientUpdateInput = Partial<ClientCreateInput>;

export type NormalizedClientCreateInput = {
  firstName: string;
  lastName: string;
  email: string | null;
  normalizedEmail: string | null;
  phone: string | null;
  normalizedPhone: string | null;
  documentNumber: string | null;
  normalizedDocument: string | null;
  notes: string | null;
  isBlocked: boolean;
};

export type NormalizedClientUpdateInput = Partial<NormalizedClientCreateInput>;

export type ClientListInput = {
  limit?: number;
  offset?: number;
  query?: string;
};

export type NormalizedClientListInput = {
  limit: number;
  offset: number;
  query: string | null;
};

export type ClientRepository = {
  list(input: {
    barberShopId: string;
    pagination: NormalizedClientListInput;
  }): Promise<ClientRecord[]>;
  create(input: {
    barberShopId: string;
    data: NormalizedClientCreateInput;
  }): Promise<ClientRecord>;
  findActiveById(input: {
    barberShopId: string;
    id: string;
  }): Promise<ClientRecord | null>;
  update(input: {
    barberShopId: string;
    id: string;
    data: NormalizedClientUpdateInput;
  }): Promise<ClientRecord | null>;
  softDelete(input: {
    barberShopId: string;
    id: string;
    deletedAt: Date;
  }): Promise<ClientRecord | null>;
};
