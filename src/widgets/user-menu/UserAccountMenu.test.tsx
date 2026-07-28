import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UserAccountMenu } from "./UserAccountMenu";

const { clearAuthSession, me } = vi.hoisted(() => ({
  clearAuthSession: vi.fn(),
  me: vi.fn(),
}));

vi.mock("@/shared/api/auth", () => ({
  authKeys: { me: ["auth", "me"] },
  clearAuthSession,
  me,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("UserAccountMenu", () => {
  it("shows current user actions and clears session on logout", async () => {
    me.mockResolvedValue({
      user: {
        id: "user_1",
        email: "admin@clipper.test",
        displayName: "Usuario Prueba",
        status: "ACTIVE",
      },
      tenant: {
        barberShopId: "shop_1",
        name: "Niche 72",
        slug: "niche-72",
        timezone: "America/Bogota",
        currency: "COP",
      },
      membership: { id: "member_1", role: "ADMIN", status: "ACTIVE" },
      tokenClaims: {},
    });

    renderUserMenu();

    await userEvent.click(
      await screen.findByRole("button", { name: "Menú de usuario" }),
    );

    expect(screen.getByRole("menuitem", { name: /Ajustes/ })).toHaveAttribute(
      "href",
      "/settings",
    );

    await userEvent.click(screen.getByRole("menuitem", { name: /Salir/ }));

    expect(clearAuthSession).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/login"),
    );
  });
});

function renderUserMenu() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <UserAccountMenu />
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function LocationProbe() {
  const location = useLocation();

  return <span data-testid="location">{location.pathname}</span>;
}
