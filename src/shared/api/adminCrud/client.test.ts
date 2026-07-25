import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";

import { AdminCrudApiError, adminListUrl, adminRequest } from "./client";
import { customersApi } from "./customers";
import { productsApi } from "./products";
import { servicesApi } from "./services";
import { staffApi } from "./staff";

afterEach(() => {
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("admin CRUD API client", () => {
  it("builds stable list URLs with pagination params", () => {
    expect(adminListUrl("/api/clients", { limit: 25, offset: 50 })).toBe(
      "/api/clients?limit=25&offset=50",
    );
  });

  it("uses authFetch headers and returns success envelope data", async () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        data: [{ id: "client_1", firstName: "Ana" }],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(customersApi.list({ limit: 10, offset: 0 })).resolves.toEqual([
      { id: "client_1", firstName: "Ana" },
    ]);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/clients?limit=10&offset=0");
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer jwt_1");
    expect(headers.get("x-barbershop-slug")).toBe("niche-72");
  });

  it("sends JSON mutation bodies", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        data: { id: "client_1", firstName: "Ana" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await customersApi.create({ firstName: "Ana", lastName: "Paz" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/clients",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ firstName: "Ana", lastName: "Paz" }),
      }),
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("sends service list and mutation requests to /api/services", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          data: { id: "service_1", name: "Corte" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await servicesApi.list({ limit: 10, offset: 20 });
    await servicesApi.update("service_1", {
      name: "Corte premium",
      durationMinutes: 45,
      basePrice: "2500",
      allowedRoles: ["BARBER"],
    });
    await servicesApi.delete("service_1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/services?limit=10&offset=20",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/services/service_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Corte premium",
          durationMinutes: 45,
          basePrice: "2500",
          allowedRoles: ["BARBER"],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/services/service_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends staff list and supported mutation fields to /api/staff", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          data: { id: "staff_1", displayName: "Ada L." },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await staffApi.list({ limit: 10, offset: 20 });
    await staffApi.update("staff_1", {
      firstName: "Ada",
      lastName: "Lovelace",
      displayName: "Ada L.",
      email: "ada@clipper.test",
      phone: null,
      isActive: true,
      commissionMode: "PERCENTAGE_BPS",
      commissionValue: "1500",
      roles: ["BARBER"],
      specialties: ["Corte", "Color"],
    });
    await staffApi.delete("staff_1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/staff?limit=10&offset=20",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/staff/staff_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          firstName: "Ada",
          lastName: "Lovelace",
          displayName: "Ada L.",
          email: "ada@clipper.test",
          phone: null,
          isActive: true,
          commissionMode: "PERCENTAGE_BPS",
          commissionValue: "1500",
          roles: ["BARBER"],
          specialties: ["Corte", "Color"],
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/staff/staff_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("sends product list and stock writes to /api/products", async () => {
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        Response.json({
          ok: true,
          data: { id: "product_1", name: "Pomada" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await productsApi.list({ limit: 10, offset: 20 });
    await productsApi.update("product_1", {
      name: "Pomada mate",
      sku: "POM-001",
      barcode: null,
      description: "Fijación media",
      catalogPrice: "4200",
      cost: null,
      stock: 8,
      lowStockAt: 2,
      isActive: true,
    });
    await productsApi.delete("product_1");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/products?limit=10&offset=20",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/products/product_1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          name: "Pomada mate",
          sku: "POM-001",
          barcode: null,
          description: "Fijación media",
          catalogPrice: "4200",
          cost: null,
          stock: 8,
          lowStockAt: 2,
          isActive: true,
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "/api/products/product_1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("surfaces server error envelopes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "VALIDATION_ERROR", message: "Nombre requerido" },
          },
          { status: 422 },
        ),
      ),
    );

    await expect(adminRequest("/api/clients")).rejects.toMatchObject({
      name: "AdminCrudApiError",
      code: "VALIDATION_ERROR",
      message: "Nombre requerido",
      status: 422,
    } satisfies Partial<AdminCrudApiError>);
  });
});
