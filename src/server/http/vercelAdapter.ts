import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";

import { getApiRoute } from "./apiRouter";

type VercelHandler = (
  request: VercelRequest,
  response: VercelResponse,
) => Promise<void> | void;

type ApiModule = {
  default: VercelHandler;
};

export type ApiModuleLoader = (modulePath: string) => Promise<ApiModule>;

export async function invokeApiRoute({
  request,
  response,
  loadModule,
}: {
  request: IncomingMessage;
  response: ServerResponse;
  loadModule: ApiModuleLoader;
}) {
  const apiRoute = getApiRoute(request.url ?? "/");

  if (!apiRoute) {
    return false;
  }

  const apiModule = await loadModule(apiRoute.modulePath);

  await apiModule.default(
    await createNodeVercelRequest(request, apiRoute.params),
    createNodeVercelResponse(response),
  );

  return true;
}

export async function createNodeVercelRequest(
  request: IncomingMessage,
  params: Record<string, string> = {},
) {
  const searchParams = Object.fromEntries(
    new URL(request.url ?? "/", "http://localhost").searchParams,
  );

  return Object.assign(request, {
    body: await readJsonBody(request),
    query: { ...searchParams, ...params },
    cookies: {},
  }) as VercelRequest;
}

export function createNodeVercelResponse(response: ServerResponse) {
  const vercelResponse = Object.assign(response, {
    status(statusCode: number) {
      response.statusCode = statusCode;
      return vercelResponse;
    },
    json(data: unknown) {
      if (!response.hasHeader("content-type")) {
        response.setHeader("content-type", "application/json");
      }
      response.end(JSON.stringify(data));
      return vercelResponse;
    },
  }) as VercelResponse;

  return vercelResponse;
}

async function readJsonBody(request: IncomingMessage) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString("utf8");

  return body ? JSON.parse(body) : undefined;
}
