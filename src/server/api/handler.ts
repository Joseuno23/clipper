import type { VercelRequest, VercelResponse } from "@vercel/node";

import { methodNotAllowed, serializeApiError } from "./errors";
import { getRequestMethod } from "./request";
import { sendFailure, sendSuccess } from "./response";

export type ApiHandlerContext = {
  method: string;
};

export type ApiHandlerResult<T> = T | Promise<T>;

export type ApiHandler<T> = (
  request: VercelRequest,
  response: VercelResponse,
  context: ApiHandlerContext,
) => ApiHandlerResult<T>;

type CreateApiHandlerOptions<T> = {
  methods: readonly string[];
  handle: ApiHandler<T>;
};

export function createApiHandler<T>({
  methods,
  handle,
}: CreateApiHandlerOptions<T>) {
  const allowedMethods = methods.map((method) => method.toUpperCase());

  return async (request: VercelRequest, response: VercelResponse) => {
    const method = getRequestMethod(request);

    try {
      if (!allowedMethods.includes(method)) {
        throw methodNotAllowed(allowedMethods);
      }

      const data = await handle(request, response, { method });
      sendSuccess(response, data);
    } catch (error) {
      const serialized = serializeApiError(error);
      sendFailure(response, serialized.status, serialized.error);
    }
  };
}
