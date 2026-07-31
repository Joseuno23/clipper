import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { PluginOption } from "vite";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export { getApiRoute } from "./src/server/http/apiRouter";
import type { ApiModuleLoader } from "./src/server/http/vercelAdapter";
import { invokeApiRoute } from "./src/server/http/vercelAdapter";

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

          try {
            const handled = await invokeApiRoute({
              request,
              response,
              loadModule: ((modulePath) =>
                server.ssrLoadModule(modulePath)) as ApiModuleLoader,
            });

            if (!handled) next();
          } catch (error) {
            next(error);
          }
        },
      );
    },
  };
}
