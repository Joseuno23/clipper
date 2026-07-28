import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { clearAuthSession, saveAuthSession } from "@/shared/api/auth";

import { SettingsView } from "./SettingsView";

afterEach(() => {
  cleanup();
  clearAuthSession();
  vi.unstubAllGlobals();
});

describe("SettingsView", () => {
  it("loads and saves shop and profile settings", async () => {
    const fetchMock = stubFetch([
      makeSettingsResponse(),
      makeSettingsResponse({ shopName: "Clipper Studio" }),
      makeSettingsResponse({ shopName: "Clipper Studio" }),
      makeSettingsResponse({ displayName: "Jose" }),
      makeSettingsResponse({ displayName: "Jose" }),
    ]);

    renderSettingsView();

    expect(await screen.findByDisplayValue("Niche 72")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Admin")).toBeInTheDocument();
    expect(screen.getByDisplayValue("admin@clipper.test")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Nombre de la barbería"));
    await userEvent.type(
      screen.getByLabelText("Nombre de la barbería"),
      "Clipper Studio",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar negocio" }),
    );

    expect(
      await screen.findByText("Nombre del negocio actualizado."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ shopName: "Clipper Studio" }),
      }),
    );

    await userEvent.clear(screen.getByLabelText("Nombre visible"));
    await userEvent.type(screen.getByLabelText("Nombre visible"), "Jose");
    await userEvent.click(
      screen.getByRole("button", { name: "Guardar perfil" }),
    );

    expect(await screen.findByText("Perfil actualizado.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ displayName: "Jose" }),
      }),
    );
  });

  it("validates and submits password changes", async () => {
    const fetchMock = stubFetch([
      makeSettingsResponse(),
      { ok: true, data: { updated: true } },
    ]);

    renderSettingsView();

    await screen.findByDisplayValue("Niche 72");
    await userEvent.type(
      screen.getByLabelText("Contraseña actual"),
      "old-password",
    );
    await userEvent.type(screen.getByLabelText("Nueva contraseña"), "short");
    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    expect(
      screen.getByText(
        "La nueva contraseña debe tener al menos 12 caracteres.",
      ),
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Nueva contraseña"));
    await userEvent.type(
      screen.getByLabelText("Nueva contraseña"),
      "new-password-12",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Cambiar contraseña" }),
    );

    expect(
      await screen.findByText("Contraseña actualizada."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/settings/password",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          currentPassword: "old-password",
          newPassword: "new-password-12",
        }),
      }),
    );
  });
});

function renderSettingsView() {
  saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <SettingsView />
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

function makeSettingsResponse(
  overrides: { shopName?: string; displayName?: string } = {},
): StubResponse {
  return {
    ok: true,
    data: {
      shop: {
        name: overrides.shopName ?? "Niche 72",
        slug: "niche-72",
      },
      user: {
        displayName: overrides.displayName ?? "Admin",
        email: "admin@clipper.test",
      },
    },
  };
}
