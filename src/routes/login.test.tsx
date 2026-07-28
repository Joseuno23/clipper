import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppProviders } from "@/app/AppProviders";
import { createTestRouter } from "@/router";
import { clearAuthSession, getAuthSession } from "@/shared/api/auth";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

function renderLoginRoute() {
  return render(
    <AppProviders>
      <RouterProvider router={createTestRouter(["/login"])} />
    </AppProviders>,
  );
}

describe("LoginPage auth wiring", () => {
  it("logs in, stores auth, and navigates to the dashboard", async () => {
    const user = userEvent.setup();
    const authData = {
      token: "jwt_1",
      user: {
        id: "user_1",
        email: "admin@clipper.test",
        displayName: "Admin User",
        status: "ACTIVE",
      },
      tenant: {
        barberShopId: "shop_1",
        name: "Clipper Test",
        slug: "niche-72",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
      membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
      tokenClaims: {},
    };
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "/api/auth/login") {
        return Promise.resolve(Response.json({ ok: true, data: authData }));
      }

      if (url === "/api/auth/me") {
        const { token: _token, ...meData } = authData;
        return Promise.resolve(Response.json({ ok: true, data: meData }));
      }

      if (url.startsWith("/api/reports/sales")) {
        return Promise.resolve(
          Response.json({
            ok: true,
            data: {
              summary: { totalRevenue: "0.00", orderCount: 0 },
              days: [],
            },
          }),
        );
      }

      if (url === "/api/queue") {
        return Promise.resolve(
          Response.json({ ok: true, data: { queues: [] } }),
        );
      }

      return Promise.resolve(Response.json({ ok: true, data: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    renderLoginRoute();
    await user.type(screen.getByPlaceholderText("mi-barberia"), "niche-72");
    await user.type(
      screen.getByPlaceholderText("tu@barberia.com"),
      "admin@clipper.test",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "secret-password");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        barberShopSlug: "niche-72",
        email: "admin@clipper.test",
        password: "secret-password",
      }),
    });
    await waitFor(() => {
      expect(getAuthSession()).toEqual({
        token: "jwt_1",
        shopSlug: "niche-72",
      });
    });
    expect(
      await screen.findByRole("heading", { name: "Buenos días, Admin User" }),
    ).toBeInTheDocument();
  });

  it("shows the API failure message without storing auth", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          {
            ok: false,
            error: { code: "UNAUTHENTICATED", message: "Invalid credentials." },
          },
          { status: 401 },
        ),
      ),
    );

    renderLoginRoute();
    await user.type(screen.getByPlaceholderText("mi-barberia"), "niche-72");
    await user.type(
      screen.getByPlaceholderText("tu@barberia.com"),
      "admin@clipper.test",
    );
    await user.type(screen.getByPlaceholderText("••••••••"), "bad-password");
    await user.click(screen.getByRole("button", { name: /entrar/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid credentials.",
    );
    expect(getAuthSession()).toBeNull();
  });
});
