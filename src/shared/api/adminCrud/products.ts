import {
  createResource,
  deleteResource,
  listResource,
  updateResource,
} from "./client";
import type {
  ListParams,
  ProductCreateInput,
  ProductDto,
  ProductUpdateInput,
} from "./types";

const PRODUCTS_PATH = "/api/products";

export const productsApi = {
  list: (params?: ListParams) =>
    listResource<ProductDto>(PRODUCTS_PATH, params),
  create: (input: ProductCreateInput) =>
    createResource<ProductDto, ProductCreateInput>(PRODUCTS_PATH, input),
  update: (id: string, input: ProductUpdateInput) =>
    updateResource<ProductDto, ProductUpdateInput>(PRODUCTS_PATH, id, input),
  delete: (id: string) => deleteResource<ProductDto>(PRODUCTS_PATH, id),
};
