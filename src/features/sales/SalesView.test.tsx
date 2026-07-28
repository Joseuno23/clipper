import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";
import type { SaleDto } from "@/shared/api/sales";
import { currency } from "@/shared/lib/format";

import { SalesView } from "./SalesView";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("SalesView", () => {
  it("shows the selected sale customer prominently in the ticket detail", async () => {
    stubSalesFetch([makeSale({ clientName: "Bruno Díaz" })]);

    renderSalesView();

    const detail = await screen.findByRole("complementary");
    expect(await within(detail).findByText("V-1")).toBeInTheDocument();
    expect(within(detail).getByText("Bruno Díaz")).toBeInTheDocument();
  });

  it("shows a clear manual sale fallback in the ticket detail", async () => {
    stubSalesFetch([
      makeSale({ appointmentId: null, clientName: "", clientId: null }),
    ]);

    renderSalesView();

    const detail = await screen.findByRole("complementary");
    expect(await within(detail).findByText("Venta manual")).toBeInTheDocument();
  });

  it("shows product quantities, subtotal, and quantity controls for draft sales", async () => {
    stubSalesFetch([
      makeSale({
        subtotal: "50000.00",
        total: "50000.00",
        items: [
          {
            id: "item_1",
            kind: "PRODUCT",
            serviceId: null,
            productId: "product_1",
            description: "Cerveza",
            quantity: 10,
            unitPrice: "5000.00",
            discountAmount: "0.00",
            total: "50000.00",
          },
        ],
      }),
    ]);

    renderSalesView();

    const detail = await screen.findByRole("complementary");
    expect(
      await within(detail).findByText(
        byExactTextContent(`10 × ${currency(5000)}`),
      ),
    ).toBeInTheDocument();
    expect(
      within(detail).getAllByText(byExactTextContent(currency(50000))).length,
    ).toBeGreaterThan(0);
    expect(
      within(detail).getByRole("button", { name: "Bajar cantidad de Cerveza" }),
    ).toBeInTheDocument();
    expect(
      within(detail).getByRole("spinbutton", { name: "Cantidad de Cerveza" }),
    ).toHaveValue(10);
    expect(
      within(detail).getByRole("button", { name: "Subir cantidad de Cerveza" }),
    ).toBeInTheDocument();
  });

  it("opens a payment confirmation dialog and does not call the API when cancelled", async () => {
    const fetchMock = stubSalesFetch([
      makeSale({ clientName: "Jose Narvaez", total: "20000.00" }),
    ]);
    const confirmMock = vi.fn(() => {
      throw new Error("Native confirm should not be used");
    });
    vi.stubGlobal("confirm", confirmMock);

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: `Cobrar ${currency(20000)}` }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Confirmar cobro",
    });
    expect(within(dialog).getByText("Jose Narvaez")).toBeInTheDocument();
    expect(within(dialog).getByText("V-1")).toBeInTheDocument();
    expect(
      within(dialog).getByText(byExactTextContent(currency(20000))),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("Transferencia")).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancelar" }),
    );

    expect(confirmMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/sales/sale_1/payments",
      expect.anything(),
    );
  });

  it("charges with transfer default only after confirming the payment dialog", async () => {
    let resolvePayment: (response: Response) => void;
    const paymentResponse = new Promise<Response>((resolve) => {
      resolvePayment = resolve;
    });
    const fetchMock = stubSalesFetch(
      [makeSale({ clientName: "Jose Narvaez", total: "20000.00" })],
      { paymentResponse },
    );
    const confirmMock = vi.fn(() => {
      throw new Error("Native confirm should not be used");
    });
    vi.stubGlobal("confirm", confirmMock);

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: `Cobrar ${currency(20000)}` }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Confirmar cobro",
    });
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    );

    expect(
      await within(dialog).findByRole("button", { name: "Cobrando…" }),
    ).toBeDisabled();
    expect(confirmMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sales/sale_1/payments",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ method: "TRANSFER" }),
        }),
      ),
    );
    resolvePayment!(
      Response.json({
        ok: true,
        data: makeSale({
          status: "COMPLETED",
          statusGroup: "closed",
          completedAt: "2026-07-27T10:05:00.000Z",
          payments: [
            {
              id: "payment_1",
              method: "TRANSFER",
              amount: "20000.00",
              reference: null,
              paidAt: "2026-07-27T10:05:00.000Z",
            },
          ],
        }),
      }),
    );
  });

  it("opens the cancel order dialog and blocks an empty reason", async () => {
    const fetchMock = stubSalesFetch([makeSale({ clientName: "Ana Paz" })]);

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: /Cancelar orden/ }),
    );

    const dialog = await screen.findByRole("dialog", {
      name: "Cancelar orden",
    });
    expect(within(dialog).getByText("Ana Paz")).toBeInTheDocument();
    expect(within(dialog).getByText("V-1")).toBeInTheDocument();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    );

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "El motivo de cancelación es obligatorio.",
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/sales/sale_1/cancel",
      expect.anything(),
    );
  });

  it("cancels a draft sale with a reason and refreshes the visible sales list", async () => {
    const fetchMock = stubSalesFetch([makeSale({ clientName: "Ana Paz" })]);

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: /Cancelar orden/ }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: "Cancelar orden",
    });
    await userEvent.type(
      within(dialog).getByLabelText("Motivo"),
      "Cliente pidió cancelar",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Confirmar" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/sales/sale_1/cancel",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ reason: "Cliente pidió cancelar" }),
        }),
      ),
    );
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/api\/sales\?status=cancelled&limit=25&offset=0&date=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.any(Object),
      ),
    );
  });

  it("shows the Canceladas filter and bounds list requests by day", async () => {
    const fetchMock = stubSalesFetch([
      makeSale({ status: "CANCELLED", statusGroup: "cancelled" }),
    ]);

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: /Canceladas/ }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/api\/sales\?status=cancelled&limit=25&offset=0&date=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.any(Object),
      ),
    );
    expect(screen.getByLabelText("Día")).toHaveAttribute("type", "date");
  });

  it("moves sales list pagination within the selected day and tab", async () => {
    const fetchMock = stubSalesFetch(
      Array.from({ length: 25 }, (_, index) =>
        makeSale({ id: `sale_${index}`, number: `V-${index}` }),
      ),
    );

    renderSalesView();

    await userEvent.click(
      await screen.findByRole("button", { name: "Siguiente" }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/api\/sales\?status=open&limit=25&offset=25&date=\d{4}-\d{2}-\d{2}$/,
        ),
        expect.any(Object),
      ),
    );
    expect(screen.getByText(/Página 2/)).toBeInTheDocument();
  });
});

function renderSalesView() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SalesView />
    </QueryClientProvider>,
  );
}

function byExactTextContent(expected: string) {
  return (_content: string, element: Element | null) =>
    element?.textContent === expected;
}

function stubSalesFetch(
  sales: SaleDto[],
  options: { paymentResponse?: Promise<Response> } = {},
) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url.startsWith("/api/sales?status=")) {
      return Promise.resolve(Response.json({ ok: true, data: sales }));
    }

    if (url === "/api/sales/sale_1/payments") {
      return (
        options.paymentResponse ??
        Promise.resolve(
          Response.json({
            ok: true,
            data: makeSale({
              status: "COMPLETED",
              statusGroup: "closed",
              completedAt: "2026-07-27T10:05:00.000Z",
              payments: [
                {
                  id: "payment_1",
                  method: "TRANSFER",
                  amount: "20000.00",
                  reference: null,
                  paidAt: "2026-07-27T10:05:00.000Z",
                },
              ],
            }),
          }),
        )
      );
    }

    if (url === "/api/sales/sale_1/cancel") {
      return Promise.resolve(
        Response.json({
          ok: true,
          data: makeSale({
            status: "CANCELLED",
            statusGroup: "cancelled",
            cancellationReason: "Cliente pidió cancelar",
          }),
        }),
      );
    }

    if (
      url === "/api/services?limit=100&offset=0" ||
      url === "/api/products?limit=100&offset=0"
    ) {
      return Promise.resolve(Response.json({ ok: true, data: [] }));
    }

    throw new Error(`Unexpected fetch call: ${url}`);
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function makeSale(overrides: Partial<SaleDto> = {}): SaleDto {
  return {
    id: "sale_1",
    appointmentId: "appointment_1",
    clientId: "client_1",
    clientName: "Ana Paz",
    staffMemberId: "staff_1",
    staffName: "Sofía",
    number: "V-1",
    status: "DRAFT",
    statusGroup: "open",
    subtotal: "5000.00",
    discountTotal: "0.00",
    taxTotal: "0.00",
    total: "5000.00",
    businessDate: "2026-07-27T12:00:00.000Z",
    completedAt: null,
    cancellationReason: null,
    createdAt: "2026-07-27T10:00:00.000Z",
    updatedAt: "2026-07-27T10:00:00.000Z",
    items: [
      {
        id: "item_1",
        kind: "SERVICE",
        serviceId: "service_1",
        productId: null,
        description: "Corte clásico",
        quantity: 1,
        unitPrice: "5000.00",
        discountAmount: "0.00",
        total: "5000.00",
      },
    ],
    payments: [],
    ...overrides,
  };
}
