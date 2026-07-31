import { afterEach, describe, expect, it, vi } from "vitest";

import {
  authFetch,
  clearAuthSession,
  createAuthHeaders,
  getAuthSession,
  login,
  saveAuthSession,
  subscribeAuthSession,
} from "./auth";

afterEach(() => {
  clearAuthSession();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("auth storage", () => {
  it("stores and reads remembered auth from localStorage", () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72", remember: true });

    expect(getAuthSession()).toEqual({ token: "jwt_1", shopSlug: "niche-72" });
    expect(window.localStorage.getItem("clipper.auth.token")).toBe("jwt_1");
    expect(window.sessionStorage.getItem("clipper.auth.token")).toBeNull();
  });

  it("stores non-remembered auth in sessionStorage and clears stale localStorage", () => {
    saveAuthSession({ token: "old_jwt", shopSlug: "old-shop", remember: true });
    saveAuthSession({ token: "jwt_2", shopSlug: "niche-72", remember: false });

    expect(getAuthSession()).toEqual({ token: "jwt_2", shopSlug: "niche-72" });
    expect(window.localStorage.getItem("clipper.auth.token")).toBeNull();
    expect(window.sessionStorage.getItem("clipper.auth.token")).toBe("jwt_2");
  });
});

describe("auth headers", () => {
  it("adds Authorization and tenant slug headers when auth is stored", () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });

    const headers = createAuthHeaders({ accept: "application/json" });

    expect(headers.get("accept")).toBe("application/json");
    expect(headers.get("authorization")).toBe("Bearer jwt_1");
    expect(headers.get("x-barbershop-slug")).toBe("niche-72");
  });

  it("leaves auth headers unset without a stored auth session", () => {
    const headers = createAuthHeaders();

    expect(headers.has("authorization")).toBe(false);
    expect(headers.has("x-barbershop-slug")).toBe(false);
  });

  it("sends stored auth headers through authFetch", async () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await authFetch("/api/auth/me", {
      headers: { accept: "application/json" },
    });

    const [, init] = fetchMock.mock.calls[0];
    const headers = init.headers as Headers;
    expect(headers.get("authorization")).toBe("Bearer jwt_1");
    expect(headers.get("x-barbershop-slug")).toBe("niche-72");
    expect(headers.get("accept")).toBe("application/json");
  });

  it("prefixes API requests with VITE_API_BASE_URL when configured", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://clipper-api.up.railway.app/");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await authFetch("/api/auth/me");

    expect(fetch).toHaveBeenCalledWith(
      "https://clipper-api.up.railway.app/api/auth/me",
      expect.any(Object),
    );
  });

  it("clears stale auth when an authenticated request returns 401", async () => {
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

    const response = await authFetch("/api/queue");

    expect(response.status).toBe(401);
    expect(getAuthSession()).toBeNull();
  });

  it("notifies auth subscribers when auth is cleared", () => {
    saveAuthSession({ token: "jwt_1", shopSlug: "niche-72" });
    const listener = vi.fn();
    const unsubscribe = subscribeAuthSession(listener);

    clearAuthSession();
    unsubscribe();

    expect(listener).toHaveBeenCalledOnce();
  });
});

describe("login client", () => {
  it("posts login credentials and returns the success data", async () => {
    const data = {
      token: "jwt_1",
      user: {
        id: "user_1",
        email: "a@b.com",
        displayName: null,
        status: "ACTIVE",
      },
      tenant: {
        barberShopId: "shop_1",
        slug: "niche-72",
        timezone: "America/Argentina/Buenos_Aires",
        currency: "ARS",
      },
      membership: { id: "member_1", role: "OWNER", status: "ACTIVE" },
      tokenClaims: {},
    };
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        ok: true,
        data,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      login({
        barberShopSlug: "niche-72",
        email: "a@b.com",
        password: "secret",
      }),
    ).resolves.toEqual(data);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        barberShopSlug: "niche-72",
        email: "a@b.com",
        password: "secret",
      }),
    });
  });
});
