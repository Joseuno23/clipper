import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./client";
import type {
  ListParams,
  ServiceCreateInput,
  ServiceDto,
  ServiceUpdateInput,
} from "./types";

const SERVICES_PATH = "/api/services";

export const servicesApi = {
  list: (params?: ListParams) =>
    listResource<ServiceDto>(SERVICES_PATH, params),
  create: (input: ServiceCreateInput) =>
    createResource<ServiceDto, ServiceCreateInput>(SERVICES_PATH, input),
  update: (id: string, input: ServiceUpdateInput) =>
    updateResource<ServiceDto, ServiceUpdateInput>(SERVICES_PATH, id, input),
  delete: (id: string) => deleteResource<ServiceDto>(SERVICES_PATH, id),
};
