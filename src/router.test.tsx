import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import { createTestRouter } from "@/router";
import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

function renderRoute(path: string) {
  return render(
    <AppProviders>
      <RouterProvider router={createTestRouter([path])} />
    </AppProviders>,
  );
}

describe("React Router route behavior", () => {
  it("redirects unauthenticated dashboard visits to login", async () => {
    renderRoute("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Bienvenido de vuelta" }),
    ).toBeInTheDocument();
  });

  it("redirects unauthenticated index visits to login", async () => {
    renderRoute("/");

    expect(
      await screen.findByRole("heading", { name: "Bienvenido de vuelta" }),
    ).toBeInTheDocument();
  });

  it("allows authenticated dashboard visits", async () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });

    renderRoute("/dashboard");

    expect(
      await screen.findByRole("heading", { name: "Buenos días, Sofía" }),
    ).toBeInTheDocument();
  });

  it.each([["/login", "Bienvenido de vuelta"]])(
    "renders %s through React Router",
    async (path, expectedText) => {
      renderRoute(path);

      expect(
        await screen.findByRole("heading", { name: expectedText }),
      ).toBeInTheDocument();
    },
  );

  it.each([
    ["/appointments", "Citas"],
    ["/queue", "Colas en vivo"],
    ["/queue/display", "Colas en vivo"],
    ["/sales", "Caja"],
    ["/customers", "Clientes"],
    ["/services", "Servicios"],
    ["/products", "Productos"],
    ["/staff", "Staff"],
    ["/reports", "Reportes"],
    ["/settings", "Configuración"],
  ])("renders authenticated private route %s", async (path, expectedText) => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true, data: [] })),
    );
    renderRoute(path);

    expect(
      await screen.findByRole("heading", { name: expectedText }),
    ).toBeInTheDocument();
  });

  it("shows a clear sidebar entry for the TV queue view", async () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ ok: true, data: [] })),
    );

    renderRoute("/queue");

    const tvLinks = await screen.findAllByRole("link", { name: "Vista TV" });

    expect(
      tvLinks.some((link) => link.getAttribute("href") === "/queue/display"),
    ).toBe(true);
  });

  it("redirects protected routes to login when an authenticated API call returns 401", async () => {
    saveAuthSession({ token: "expired_jwt", shopSlug: "niche-72" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "UNAUTHENTICATED", message: "Token expired." },
          },
          { status: 401 },
        ),
      ),
    );

    renderRoute("/queue");

    expect(
      await screen.findByRole("heading", { name: "Bienvenido de vuelta" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("No se pudieron cargar las colas")).toBeNull();
  });

  it("renders not-found behavior for unknown routes", async () => {
    renderRoute("/unknown-route");

    expect(await screen.findByText("Página no encontrada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
