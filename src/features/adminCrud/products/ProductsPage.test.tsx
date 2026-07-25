import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { ProductDto } from "@/shared/api/adminCrud";

import { ProductsCrudPage } from "./ProductsPage";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("ProductsCrudPage", () => {
  it("renders product rows from the API with stock fallback", async () => {
    stubFetch([
      {
        ok: true,
        data: [
          makeProduct({
            name: "Pomada mate",
            sku: "POM-001",
            barcode: "7790001",
            stock: undefined,
            currentStock: 7,
          }),
        ],
      },
    ]);

    renderProductsPage();

    expect(await screen.findByText("Pomada mate")).toBeInTheDocument();
    expect(screen.getByText("POM-001 · 7790001")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("refreshes the list after creating a product and writes stock explicitly", async () => {
    const fetchMock = stubFetch([
      { ok: true, data: [] },
      { ok: true, data: makeProduct({ name: "Aceite barba", stock: 4 }) },
      { ok: true, data: [makeProduct({ name: "Aceite barba", stock: 4 })] },
    ]);
    renderProductsPage();

    await screen.findByText("Todavía no hay productos");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo producto" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Aceite barba");
    await userEvent.type(screen.getByLabelText("SKU"), "ACE-001");
    await userEvent.type(screen.getByLabelText("Precio de catálogo"), "3500");
    await userEvent.clear(screen.getByLabelText("Stock"));
    await userEvent.type(screen.getByLabelText("Stock"), "4");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Aceite barba")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/products",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          name: "Aceite barba",
          sku: "ACE-001",
          barcode: null,
          description: null,
          catalogPrice: "3500",
          cost: null,
          stock: 4,
          lowStockAt: null,
          isActive: true,
        }),
      }),
    );
  });

  it("shows server errors without losing entered form values", async () => {
    stubFetch([
      { ok: true, data: [] },
      {
        ok: false,
        error: { code: "CONFLICT", message: "Product already exists" },
        status: 409,
      },
    ]);
    renderProductsPage();

    await screen.findByText("Todavía no hay productos");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo producto" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Pomada");
    await userEvent.type(screen.getByLabelText("Precio de catálogo"), "4200");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Product already exists"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Pomada");
  });

  it("blocks invalid product input with local validation", async () => {
    stubFetch([{ ok: true, data: [] }]);
    renderProductsPage();

    await screen.findByText("Todavía no hay productos");
    await userEvent.click(
      screen.getByRole("button", { name: "Nuevo producto" }),
    );
    await userEvent.type(screen.getByLabelText("Nombre"), "Pomada");
    await userEvent.type(screen.getByLabelText("Precio de catálogo"), "4200");
    await userEvent.clear(screen.getByLabelText("Stock"));
    await userEvent.type(screen.getByLabelText("Stock"), "-1");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText(
        "El stock debe ser un número entero mayor o igual a cero.",
      ),
    ).toBeInTheDocument();
  });

  it("requests the next offset when clicking Next", async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) =>
      makeProduct({ id: `product_${index}`, name: `Producto ${index}` }),
    );
    const fetchMock = stubFetch([
      { ok: true, data: firstPage },
      {
        ok: true,
        data: [makeProduct({ id: "product_10", name: "Producto 10" })],
      },
    ]);

    renderProductsPage();

    await screen.findByText("Producto 0");
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    await screen.findByText("Producto 10");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/products?limit=10&offset=10",
      expect.any(Object),
    );
  });
});

function renderProductsPage() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ProductsCrudPage />
    </QueryClientProvider>,
  );
}

type StubResponse =
  | { ok: true; data: unknown; status?: number }
  | {
      ok: false;
      error: { code: string; message: string; details?: unknown };
      status?: number;
    };

function stubFetch(responses: StubResponse[]) {
  const fetchMock = vi.fn().mockImplementation(() => {
    const response = responses.shift();

    if (!response) {
      throw new Error("Unexpected fetch call");
    }

    const status = response.status ?? (response.ok ? 200 : 400);
    return Promise.resolve(Response.json(response, { status }));
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeProduct(overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: "product_1",
    name: "Pomada",
    sku: "POM-001",
    barcode: null,
    description: "Fijación media",
    catalogPrice: "4200.00",
    cost: null,
    currentStock: 5,
    stock: 5,
    lowStockAt: 2,
    isActive: true,
    category: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
