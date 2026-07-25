// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceRoot = path.resolve(process.cwd(), "src");
const forbiddenImportPatterns = [
  /from\s+["'][^"']*server\/db\/client["']/,
  /from\s+["'][^"']*server\/domain\/auth\//,
  /from\s+["'][^"']*server\/repositories\//,
  /from\s+["'][^"']*generated\/prisma\/(?:client|internal|models)[^"']*["']/,
  /from\s+["']@prisma\/client(?:\/[^"']*)?["']/,
  /import\s*\(["'][^"']*server\/db\/client["']\)/,
  /import\s*\(["'][^"']*server\/domain\/auth\//,
  /import\s*\(["'][^"']*server\/repositories\//,
  /import\s*\(["'][^"']*generated\/prisma\/(?:client|internal|models)[^"']*["']\)/,
  /import\s*\(["']@prisma\/client(?:\/[^"']*)?["']\)/,
];

function collectBrowserSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      if (["generated", "server", "test"].includes(entry.name)) {
        return [];
      }

      return collectBrowserSourceFiles(fullPath);
    }

    if (
      !/\.(ts|tsx)$/.test(entry.name) ||
      /\.(test|spec)\.(ts|tsx)$/.test(entry.name)
    ) {
      return [];
    }

    return [fullPath];
  });
}

describe("server-only import boundary", () => {
  it("keeps server-only auth, Prisma, db, and repository imports out of browser-facing src code", () => {
    const violations = collectBrowserSourceFiles(sourceRoot).flatMap(
      (filePath) => {
        const source = readFileSync(filePath, "utf8");

        if (!forbiddenImportPatterns.some((pattern) => pattern.test(source))) {
          return [];
        }

        return [path.relative(process.cwd(), filePath)];
      },
    );

    expect(violations).toEqual([]);
  });
});
