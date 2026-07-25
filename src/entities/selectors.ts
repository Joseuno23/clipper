import { customers, products, services, staff } from "@/entities/mock-data";

export const findCustomer = (id?: string) => customers.find((c) => c.id === id);
export const findStaff = (id?: string) => staff.find((s) => s.id === id);
export const findService = (id?: string) => services.find((s) => s.id === id);
export const findProduct = (id?: string) => products.find((p) => p.id === id);
