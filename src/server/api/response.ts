import type { VercelResponse } from "@vercel/node";

import type { SerializedApiError } from "./errors";

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: SerializedApiError };
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export function sendJson<T>(
  response: VercelResponse,
  status: number,
  envelope: ApiEnvelope<T>,
) {
  response.status(status).json(envelope);
}

export function sendSuccess<T>(
  response: VercelResponse,
  data: T,
  status = 200,
) {
  sendJson(response, status, { ok: true, data });
}

export function sendFailure(
  response: VercelResponse,
  status: number,
  error: SerializedApiError,
) {
  sendJson(response, status, { ok: false, error });
}
