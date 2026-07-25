import type { VercelRequest } from "@vercel/node";

import { ApiError } from "./errors";

export type JsonBody = Record<string, unknown> | unknown[];

export function getRequestMethod(request: Pick<VercelRequest, "method">) {
  return request.method?.toUpperCase() ?? "GET";
}

export function parseJsonBody(request: Pick<VercelRequest, "body">): JsonBody {
  const { body } = request;

  if (body === undefined || body === null || body === "") {
    throw new ApiError({
      code: "BAD_REQUEST",
      message: "Request body is required.",
    });
  }

  if (typeof body === "string") {
    try {
      return assertJsonBody(JSON.parse(body));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError({
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      });
    }
  }

  return assertJsonBody(body);
}

export function getBearerToken(
  headers: Pick<VercelRequest, "headers">["headers"],
) {
  const authorization = headers.authorization;
  const rawValue = Array.isArray(authorization)
    ? authorization[0]
    : authorization;

  if (typeof rawValue !== "string" || rawValue.trim() === "") {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Authorization Bearer token is required.",
    });
  }

  const [scheme, token, ...extraParts] = rawValue.trim().split(/\s+/);

  if (scheme !== "Bearer" || !token || extraParts.length > 0) {
    throw new ApiError({
      code: "UNAUTHENTICATED",
      message: "Authorization header must use Bearer token format.",
    });
  }

  return token;
}

function assertJsonBody(value: unknown): JsonBody {
  if (typeof value === "object" && value !== null) {
    return value as JsonBody;
  }

  throw new ApiError({
    code: "BAD_REQUEST",
    message: "Request body must be a JSON object or array.",
  });
}
