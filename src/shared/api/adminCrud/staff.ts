import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./client";
import type {
  ListParams,
  StaffCreateInput,
  StaffDto,
  StaffUpdateInput,
} from "./types";

const STAFF_PATH = "/api/staff";

export const staffApi = {
  list: (params?: ListParams) => listResource<StaffDto>(STAFF_PATH, params),
  create: (input: StaffCreateInput) =>
    createResource<StaffDto, StaffCreateInput>(STAFF_PATH, input),
  update: (id: string, input: StaffUpdateInput) =>
    updateResource<StaffDto, StaffUpdateInput>(STAFF_PATH, id, input),
  delete: (id: string) => deleteResource<StaffDto>(STAFF_PATH, id),
};
