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

  it("renders not-found behavior for unknown routes", async () => {
    renderRoute("/unknown-route");

    expect(await screen.findByText("Página no encontrada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Volver al dashboard" }),
    ).toHaveAttribute("href", "/dashboard");
  });
});
