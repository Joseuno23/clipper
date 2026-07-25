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

          const apiRoute = getApiRoute(request.url);

          if (!apiRoute) {
            next();
            return;
          }

          try {
            const apiModule = await server.ssrLoadModule(apiRoute.modulePath);
            const handler = apiModule.default as (
              request: VercelRequest,
              response: VercelResponse,
            ) => Promise<void> | void;

            await handler(
              await createLocalVercelRequest(request, apiRoute.params),
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

type ApiRoute = {
  modulePath: string;
  params: Record<string, string>;
};

function getApiRoute(url: string): ApiRoute | null {
  const { pathname } = new URL(url, "http://localhost");
  const relativePath = pathname.replace(/^\/api\//, "");

  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  const exactModulePath = path.resolve(__dirname, "api", `${relativePath}.ts`);

  if (existsSync(exactModulePath)) {
    return { modulePath: exactModulePath, params: {} };
  }

  const segments = relativePath.split("/").filter(Boolean);

  if (segments.length === 1) {
    const indexModulePath = path.resolve(
      __dirname,
      "api",
      segments[0],
      "index.ts",
    );

    return existsSync(indexModulePath)
      ? { modulePath: indexModulePath, params: {} }
      : null;
  }

  if (segments.length === 2) {
    const dynamicModulePath = path.resolve(
      __dirname,
      "api",
      segments[0],
      "[id].ts",
    );

    return existsSync(dynamicModulePath)
      ? { modulePath: dynamicModulePath, params: { id: segments[1] } }
      : null;
  }

  return null;
}

async function createLocalVercelRequest(
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
