import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./client";
import type {
  CustomerCreateInput,
  CustomerDto,
  CustomerUpdateInput,
  ListParams,
} from "./types";

const CLIENTS_PATH = "/api/clients";

export const customersApi = {
  list: (params?: ListParams) =>
    listResource<CustomerDto>(CLIENTS_PATH, params),
  create: (input: CustomerCreateInput) =>
    createResource<CustomerDto, CustomerCreateInput>(CLIENTS_PATH, input),
  update: (id: string, input: CustomerUpdateInput) =>
    updateResource<CustomerDto, CustomerUpdateInput>(CLIENTS_PATH, id, input),
  delete: (id: string) => deleteResource<CustomerDto>(CLIENTS_PATH, id),
};

export const adminCrudKeys = {
  customers: ["adminCrud", "customers"] as const,
  customersList: (params: ListParams) =>
    [...adminCrudKeys.customers, "list", params] as const,
  services: ["adminCrud", "services"] as const,
  servicesList: (params: ListParams) =>
    [...adminCrudKeys.services, "list", params] as const,
  staff: ["adminCrud", "staff"] as const,
  staffList: (params: ListParams) =>
    [...adminCrudKeys.staff, "list", params] as const,
  products: ["adminCrud", "products"] as const,
  productsList: (params: ListParams) =>
    [...adminCrudKeys.products, "list", params] as const,
};
