import type { VercelRequest } from "@vercel/node";

import { ApiError } from "./errors";

export function parsePathId(request: VercelRequest, resource: string) {
  const queryId = request.query?.id;

  if (Array.isArray(queryId)) {
    throw invalidIdError(resource);
  }

  const rawId = queryId ?? parseIdFromUrl(request.url, resource);

  if (typeof rawId !== "string" || rawId.trim() === "") {
    throw invalidIdError(resource);
  }

  return rawId.trim();
}

function parseIdFromUrl(url: string | undefined, resource: string) {
  if (!url) {
    return null;
  }

  const { pathname } = new URL(url, "http://localhost");
  const segments = pathname.split("/").filter(Boolean);
  const apiIndex = segments.indexOf("api");

  if (apiIndex < 0 || segments[apiIndex + 1] !== resource) {
    return null;
  }

  return segments[apiIndex + 2] ?? null;
}

function invalidIdError(resource: string) {
  return new ApiError({
    code: "BAD_REQUEST",
    message: `${resource} id is required.`,
    details: { field: "id" },
  });
}
