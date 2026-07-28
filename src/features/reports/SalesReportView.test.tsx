import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";

import { SalesReportView } from "./SalesReportView";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("SalesReportView", () => {
  it("renders sales summary and sends product/service filters", async () => {
    const fetchMock = stubFetch();

    renderView();

    expect(await screen.findByText("Reporte de ventas")).toBeInTheDocument();
    expect(
      (await screen.findAllByText(/Corte clásico/)).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$\s23\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Pomada/).length).toBeGreaterThan(0);

    await screen.findByRole("option", { name: "Corte clásico" });
    await userEvent.selectOptions(screen.getByLabelText("Tipo"), "PRODUCT");
    await userEvent.selectOptions(
      screen.getByLabelText("Servicio"),
      "service_1",
    );
    await userEvent.selectOptions(
      screen.getByLabelText("Producto"),
      "product_1",
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /\/api\/reports\/sales\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&itemType=PRODUCT&serviceId=service_1&productId=product_1/,
        ),
        expect.any(Object),
      ),
    );
  });

  it("surfaces report API error message and code", async () => {
    stubFetch({
      reportError: {
        code: "UNAUTHENTICATED",
        message: "La sesión expiró. Volvé a iniciar sesión.",
      },
    });

    renderView();

    expect(
      await screen.findByText(
        "No se pudo cargar el reporte: La sesión expiró. Volvé a iniciar sesión. (UNAUTHENTICATED)",
      ),
    ).toBeInTheDocument();
  });
});

function renderView() {
  saveAuthSession({ token: "jwt_1", shopSlug: "clipper" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SalesReportView />
    </QueryClientProvider>,
  );
}

function stubFetch(options?: {
  reportError?: { code: string; message: string };
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url === "/api/services?limit=100&offset=0") {
      return Promise.resolve(
        Response.json({
          ok: true,
          data: [{ id: "service_1", name: "Corte clásico" }],
        }),
      );
    }

    if (url === "/api/products?limit=100&offset=0") {
      return Promise.resolve(
        Response.json({
          ok: true,
          data: [{ id: "product_1", name: "Pomada" }],
        }),
      );
    }

    if (url.startsWith("/api/reports/sales?")) {
      if (options?.reportError) {
        return Promise.resolve(
          Response.json(
            { ok: false, error: options.reportError },
            { status: 401 },
          ),
        );
      }

      return Promise.resolve(
        Response.json({
          ok: true,
          data: {
            from: "2026-07-27",
            to: "2026-07-27",
            itemType: "all",
            serviceId: "all",
            productId: "all",
            summary: {
              totalRevenue: "23000.00",
              servicesRevenue: "15000.00",
              productsRevenue: "8000.00",
              orderCount: 1,
              itemLineCount: 2,
              quantityTotal: 3,
            },
            days: [
              {
                date: "2026-07-27",
                totalRevenue: "23000.00",
                servicesRevenue: "15000.00",
                productsRevenue: "8000.00",
                orderCount: 1,
                itemLineCount: 2,
                quantityTotal: 3,
                items: [
                  {
                    saleId: "sale_1",
                    saleNumber: "V-1",
                    clientName: "Ana Ríos",
                    staffName: "Sofía Paz",
                    itemType: "SERVICE",
                    itemName: "Corte clásico",
                    quantity: 1,
                    total: "15000.00",
                  },
                  {
                    saleId: "sale_1",
                    saleNumber: "V-1",
                    clientName: "Ana Ríos",
                    staffName: "Sofía Paz",
                    itemType: "PRODUCT",
                    itemName: "Pomada",
                    quantity: 2,
                    total: "8000.00",
                  },
                ],
              },
            ],
          },
        }),
      );
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
