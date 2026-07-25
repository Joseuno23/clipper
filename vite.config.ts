import { existsSync } from "node:fs";
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths(), localApiPlugin()],
  test: {
    environment: "jsdom",
    include: ["api/**/*.test.ts", "src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: "./src/test/setup.ts",
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

function localApiPlugin(): PluginOption {
  return {
    name: "clipper-local-api",
    configureServer(server) {
      server.middlewares.use(
        async (
          request: IncomingMessage,
          response: ServerResponse,
          next: (error?: unknown) => void,
        ) => {
          if (!request.url?.startsWith("/api/")) {
            next();
            return;
          }

          const apiModulePath = getApiModulePath(request.url);

          if (!apiModulePath) {
            next();
            return;
          }

          try {
            const apiModule = await server.ssrLoadModule(apiModulePath);
            const handler = apiModule.default as (
              request: VercelRequest,
              response: VercelResponse,
            ) => Promise<void> | void;

            await handler(
              await createLocalVercelRequest(request),
              createLocalVercelResponse(response),
            );
          } catch (error) {
            next(error);
          }
        },
      );
    },
  };
}

function getApiModulePath(url: string) {
  const { pathname } = new URL(url, "http://localhost");
  const relativePath = pathname.replace(/^\/api\//, "");

  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  const apiModulePath = path.resolve(__dirname, "api", `${relativePath}.ts`);

  return existsSync(apiModulePath) ? apiModulePath : null;
}

async function createLocalVercelRequest(request: IncomingMessage) {
  return Object.assign(request, {
    body: await readJsonBody(request),
    query: Object.fromEntries(
      new URL(request.url ?? "/", "http://localhost").searchParams,
    ),
    cookies: {},
  }) as VercelRequest;
}

function createLocalVercelResponse(response: ServerResponse) {
  const vercelResponse = Object.assign(response, {
    status(statusCode: number) {
      response.statusCode = statusCode;
      return vercelResponse;
    },
    json(data: unknown) {
      response.setHeader("content-type", "application/json");
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
