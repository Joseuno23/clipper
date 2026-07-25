import { authFetch } from "@/shared/api/auth";

import type { AdminApiErrorEnvelope, ApiEnvelope, ListParams } from "./types";

export class AdminCrudApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor({
    code,
    message,
    status,
    details,
  }: AdminApiErrorEnvelope & { status: number }) {
    super(message);
    this.name = "AdminCrudApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function adminListUrl(path: string, params: ListParams = {}) {
  const search = new URLSearchParams();

  if (params.limit !== undefined) search.set("limit", String(params.limit));
  if (params.offset !== undefined) search.set("offset", String(params.offset));

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

export async function readAdminEnvelope<T>(response: Response): Promise<T> {
  let envelope: ApiEnvelope<T> | null = null;

  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new AdminCrudApiError({
      code: "INVALID_RESPONSE",
      message: response.ok
        ? "La respuesta del servidor no tiene un formato válido."
        : "No se pudo procesar la respuesta del servidor.",
      status: response.status,
    });
  }

  if (!response.ok || !envelope.ok) {
    const error = envelope.ok
      ? {
          code: "HTTP_ERROR",
          message: "No se pudo completar la operación.",
        }
      : envelope.error;

    throw new AdminCrudApiError({ ...error, status: response.status });
  }

  return envelope.data;
}

export async function adminRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
) {
  return readAdminEnvelope<T>(await authFetch(input, init));
}

export function listResource<T>(path: string, params?: ListParams) {
  return adminRequest<T[]>(adminListUrl(path, params));
}

export function createResource<TResponse, TInput>(path: string, input: TInput) {
  return jsonRequest<TResponse, TInput>(path, "POST", input);
}

export function updateResource<TResponse, TInput>(
  path: string,
  id: string,
  input: TInput,
) {
  return jsonRequest<TResponse, TInput>(`${path}/${id}`, "PATCH", input);
}

export function deleteResource<TResponse>(path: string, id: string) {
  return adminRequest<TResponse>(`${path}/${id}`, { method: "DELETE" });
}

function jsonRequest<TResponse, TInput>(
  url: string,
  method: "POST" | "PATCH",
  input: TInput,
) {
  return adminRequest<TResponse>(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}
