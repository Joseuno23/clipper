import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";

import { StaffLiquidationsView } from "./StaffLiquidationsView";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("StaffLiquidationsView", () => {
  it("defaults to Todos and renders summary/detail grouped by day", async () => {
    const fetchMock = stubReportFetch();

    renderView();

    expect(screen.getByLabelText("Staff")).toHaveValue("all");
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\/api\/reports\/staff-liquidations\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}&staffMemberId=all$/,
        ),
        expect.any(Object),
      ),
    );
    expect(await screen.findAllByText("Sofía Paz")).toHaveLength(2);
    expect(screen.getAllByText(/\$\s10\.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/\$\s2\.500/).length).toBeGreaterThan(0);

    await userEvent.click(screen.getByRole("button", { name: /Ver detalle/ }));

    const detail = await screen.findByText("Detalle de Sofía Paz");
    expect(detail).toBeInTheDocument();
    expect(screen.getByText("lunes, 27 de julio")).toBeInTheDocument();
    expect(screen.getByText(/Corte clásico/)).toBeInTheDocument();
    expect(screen.getByText(/Ana Ríos/)).toBeInTheDocument();
  });

  it("sends selected staff and explicit date range as query params", async () => {
    const fetchMock = stubReportFetch();

    renderView();

    await screen.findByRole("option", { name: "Sofía Paz" });
    await userEvent.selectOptions(screen.getByLabelText("Staff"), "staff_1");
    fireEvent.change(screen.getByLabelText("Desde"), {
      target: { value: "2026-07-01" },
    });
    fireEvent.change(screen.getByLabelText("Hasta"), {
      target: { value: "2026-07-31" },
    });

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reports/staff-liquidations?from=2026-07-01&to=2026-07-31&staffMemberId=staff_1",
        expect.any(Object),
      ),
    );
  });

  it("surfaces report API error message and code", async () => {
    stubReportFetch({
      reportError: {
        code: "FORBIDDEN",
        message: "El comercio de la sesión no coincide con el reporte.",
      },
    });

    renderView();

    expect(
      await screen.findByText(
        "No se pudo cargar el reporte: El comercio de la sesión no coincide con el reporte. (FORBIDDEN)",
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
      <StaffLiquidationsView />
    </QueryClientProvider>,
  );
}

function stubReportFetch(options?: {
  reportError?: { code: string; message: string };
}) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const url = input.toString();

    if (url === "/api/staff?limit=100&offset=0") {
      return Promise.resolve(
        Response.json({
          ok: true,
          data: [
            {
              id: "staff_1",
              userId: null,
              firstName: "Sofía",
              lastName: "Paz",
              displayName: "Sofía Paz",
              email: null,
              phone: null,
              isActive: true,
              commissionMode: "NONE",
              commissionValue: "0.00",
              workingDays: [],
              restDays: [],
              specialties: [],
              roles: [],
              serviceCommissions: [],
              createdAt: "2026-07-27T10:00:00.000Z",
              updatedAt: "2026-07-27T10:00:00.000Z",
            },
          ],
        }),
      );
    }

    if (url.startsWith("/api/reports/staff-liquidations?")) {
      if (options?.reportError) {
        return Promise.resolve(
          Response.json(
            { ok: false, error: options.reportError },
            { status: 403 },
          ),
        );
      }

      return Promise.resolve(
        Response.json({
          ok: true,
          data: {
            from: "2026-07-27",
            to: "2026-07-27",
            staffMemberId: "all",
            summaries: [
              {
                staffMemberId: "staff_1",
                staffName: "Sofía Paz",
                soldTotal: "10000.00",
                commissionTotal: "2500.00",
                orderCount: 1,
                serviceLineCount: 1,
              },
            ],
            details: [
              {
                staffMemberId: "staff_1",
                staffName: "Sofía Paz",
                soldTotal: "10000.00",
                commissionTotal: "2500.00",
                orderCount: 1,
                serviceLineCount: 1,
                days: [
                  {
                    date: "2026-07-27",
                    soldTotal: "10000.00",
                    commissionTotal: "2500.00",
                    orderCount: 1,
                    serviceLineCount: 1,
                    items: [
                      {
                        saleId: "sale_1",
                        saleNumber: "V-1",
                        clientName: "Ana Ríos",
                        serviceName: "Corte clásico",
                        quantity: 1,
                        soldTotal: "10000.00",
                        commissionTotal: "2500.00",
                      },
                    ],
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
