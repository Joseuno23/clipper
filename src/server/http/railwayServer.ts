import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { pathToFileURL } from "node:url";

import { invokeApiRoute, type ApiModuleLoader } from "./vercelAdapter";

const DEFAULT_PORT = 3001;

export type RailwayServerOptions = {
  allowedOrigins?: string[];
  loadModule?: ApiModuleLoader;
};

export function createRailwayServer(options: RailwayServerOptions = {}) {
  const loadModule = options.loadModule ?? importApiModule;
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();

  return createServer(async (request, response) => {
    setCorsHeaders(request, response, allowedOrigins);

    if (request.method === "OPTIONS") {
      response.statusCode = 204;
      response.end();
      return;
    }

    if (!request.url?.startsWith("/api/")) {
      sendJson(response, 404, {
        ok: false,
        error: { code: "NOT_FOUND", message: "API route not found." },
      });
      return;
    }

    try {
      const handled = await invokeApiRoute({ request, response, loadModule });

      if (!handled && !response.writableEnded) {
        sendJson(response, 404, {
          ok: false,
          error: { code: "NOT_FOUND", message: "API route not found." },
        });
      }
    } catch (error) {
      console.error("Unhandled API error", error);

      if (!response.writableEnded) {
        sendJson(response, 500, {
          ok: false,
          error: {
            code: "INTERNAL_SERVER_ERROR",
            message: "An unexpected error occurred.",
          },
        });
      }
    }
  });
}

export function startRailwayServer() {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createRailwayServer();

  server.listen(port, () => {
    console.info(`Clipper API listening on port ${port}`);
  });

  return server;
}

export function getAllowedOrigins() {
  return (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function setCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedOrigins: string[],
) {
  const origin = request.headers.origin;
  const allowOrigin =
    origin && (allowedOrigins.includes(origin) || allowedOrigins.includes("*"))
      ? origin
      : allowedOrigins.includes("*")
        ? "*"
        : undefined;

  if (allowOrigin) {
    response.setHeader("access-control-allow-origin", allowOrigin);
    response.setHeader("vary", "Origin");
  }

  response.setHeader(
    "access-control-allow-methods",
    "GET,POST,PATCH,DELETE,OPTIONS",
  );
  response.setHeader(
    "access-control-allow-headers",
    "authorization,content-type,x-barbershop-slug",
  );
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown) {
  response.statusCode = statusCode;
  response.setHeader("content-type", "application/json");
  response.end(JSON.stringify(body));
}

async function importApiModule(modulePath: string) {
  return import(pathToFileURL(modulePath).href);
}
