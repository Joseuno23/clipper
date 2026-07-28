const AUTH_TOKEN_KEY = "clipper.auth.token";
const AUTH_SHOP_SLUG_KEY = "clipper.auth.shopSlug";

type StorageKind = "local" | "session";

const authSessionListeners = new Set<() => void>();

export type AuthSession = {
  token: string;
  shopSlug: string;
};

export type SaveAuthSessionInput = AuthSession & {
  remember?: boolean;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
};

export type AuthTenant = {
  barberShopId: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
};

export type AuthMembership = {
  id: string;
  role: string;
  status: string;
};

export type AuthContextResponse = {
  user: AuthUser;
  tenant: AuthTenant;
  membership: AuthMembership;
  tokenClaims: Record<string, unknown>;
};

export type LoginResponse = AuthContextResponse & {
  token: string;
};

export const authKeys = {
  me: ["auth", "me"] as const,
};

type ApiEnvelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

export class AuthApiError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status,
    details,
  }: {
    code: string;
    message: string;
    status?: number;
    details?: unknown;
  }) {
    super(message);
    this.name = "AuthApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function saveAuthSession({
  token,
  shopSlug,
  remember = true,
}: SaveAuthSessionInput) {
  const targetKind: StorageKind = remember ? "local" : "session";
  const otherKind: StorageKind = remember ? "session" : "local";
  const target = getStorage(targetKind);

  if (!target) {
    return;
  }

  setStoredSession(target, { token, shopSlug });
  clearStoredSession(getStorage(otherKind));
  emitAuthSessionChange();
}

export function getAuthSession(): AuthSession | null {
  return (
    getStoredSession(getStorage("local")) ??
    getStoredSession(getStorage("session"))
  );
}

export function clearAuthSession() {
  clearStoredSession(getStorage("local"));
  clearStoredSession(getStorage("session"));
  emitAuthSessionChange();
}

export function subscribeAuthSession(listener: () => void) {
  authSessionListeners.add(listener);

  return () => {
    authSessionListeners.delete(listener);
  };
}

export function createAuthHeaders(headers?: HeadersInit): Headers {
  const nextHeaders = new Headers(headers);
  const session = getAuthSession();

  if (session) {
    nextHeaders.set("Authorization", `Bearer ${session.token}`);
    nextHeaders.set("x-barbershop-slug", session.shopSlug);
  }

  return nextHeaders;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  const response = await fetch(input, {
    ...init,
    headers: createAuthHeaders(init.headers),
  });

  if (response.status === 401) {
    clearAuthSession();
  }

  return response;
}

export async function login(input: {
  barberShopSlug: string;
  email: string;
  password: string;
}): Promise<LoginResponse> {
  return readEnvelope<LoginResponse>(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function me(): Promise<AuthContextResponse> {
  return readEnvelope<AuthContextResponse>(await authFetch("/api/auth/me"));
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;

  if (!envelope.ok) {
    throw new AuthApiError({ ...envelope.error, status: response.status });
  }

  return envelope.data;
}

function getStorage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function setStoredSession(storage: Storage, session: AuthSession) {
  try {
    storage.setItem(AUTH_TOKEN_KEY, session.token);
    storage.setItem(AUTH_SHOP_SLUG_KEY, session.shopSlug);
  } catch {
    // Storage may be unavailable in private/locked-down browser contexts.
  }
}

function getStoredSession(storage: Storage | null): AuthSession | null {
  if (!storage) {
    return null;
  }

  try {
    const token = storage.getItem(AUTH_TOKEN_KEY);
    const shopSlug = storage.getItem(AUTH_SHOP_SLUG_KEY);

    return token && shopSlug ? { token, shopSlug } : null;
  } catch {
    return null;
  }
}

function clearStoredSession(storage: Storage | null) {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(AUTH_SHOP_SLUG_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

function emitAuthSessionChange() {
  authSessionListeners.forEach((listener) => listener());
}
