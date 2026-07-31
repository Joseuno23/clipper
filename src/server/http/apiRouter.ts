import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_API_ROOT = fileURLToPath(
  new URL("../../../api", import.meta.url),
);

export type ApiRoute = {
  modulePath: string;
  params: Record<string, string>;
};

export function getApiRoute(
  url: string,
  apiRoot: string = DEFAULT_API_ROOT,
): ApiRoute | null {
  const { pathname } = new URL(url, "http://localhost");

  if (!pathname.startsWith("/api/")) {
    return null;
  }

  const relativePath = pathname.replace(/^\/api\//, "");

  if (!relativePath || relativePath.includes("..")) {
    return null;
  }

  const exactModulePath = path.resolve(apiRoot, `${relativePath}.ts`);

  if (existsSync(exactModulePath)) {
    return { modulePath: exactModulePath, params: {} };
  }

  const segments = relativePath.split("/").filter(Boolean);

  if (segments.length === 1) {
    const indexModulePath = path.resolve(apiRoot, segments[0], "index.ts");

    return existsSync(indexModulePath)
      ? { modulePath: indexModulePath, params: {} }
      : null;
  }

  if (segments.length === 2) {
    const dynamicModulePath = path.resolve(apiRoot, segments[0], "[id].ts");

    return existsSync(dynamicModulePath)
      ? { modulePath: dynamicModulePath, params: { id: segments[1] } }
      : null;
  }

  if (segments.length > 2) {
    const nestedDynamicModulePath = path.resolve(
      apiRoot,
      segments[0],
      "[id]",
      `${segments.slice(2).join("/")}.ts`,
    );

    return existsSync(nestedDynamicModulePath)
      ? { modulePath: nestedDynamicModulePath, params: { id: segments[1] } }
      : null;
  }

  return null;
}
