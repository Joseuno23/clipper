import { cleanup, render, screen } from "@testing-library/react";
import { RouterProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import { createTestRouter } from "@/router";

afterEach(() => {
  cleanup();
});

function renderRoute(path: string) {
  return render(
    <AppProviders>
      <RouterProvider router={createTestRouter([path])} />
    </AppProviders>,
  );
}

describe("React Router route behavior", () => {
  it("redirects the index route to the dashboard", async () => {
    renderRoute("/");

    expect(
      await screen.findByRole("heading", { name: "Buenos días, Sofía" }),
    ).toBeInTheDocument();
  });

  it.each([
    ["/login", "Bienvenido de vuelta"],
    ["/dashboard", "Buenos días, Sofía"],
    ["/appointments", "Citas"],
    ["/queue", "Colas en vivo"],
    ["/sales", "Caja"],
    ["/customers", "Clientes"],
    ["/services", "Servicios"],
    ["/products", "Productos"],
    ["/staff", "Staff"],
    ["/reports", "Reportes"],
    ["/settings", "Configuración"],
  ])("renders %s through React Router", async (path, expectedText) => {
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
