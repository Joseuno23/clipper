// @vitest-environment node
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";

import { getApiRoute } from "./apiRouter";
import { getAllowedOrigins } from "./railwayServer";
import { invokeApiRoute } from "./vercelAdapter";

describe("Node API route adapter", () => {
  it("resolves exact, index, dynamic, and nested dynamic API modules", () => {
    expect(getApiRoute("/api/health")?.modulePath).toMatch(/api\/health\.ts$/);
    expect(getApiRoute("/api/clients")?.modulePath).toMatch(
      /api\/clients\/index\.ts$/,
    );
    expect(getApiRoute("/api/clients/client_1")?.params).toEqual({
      id: "client_1",
    });
    expect(getApiRoute("/api/sales/sale_1/payments")?.params).toEqual({
      id: "sale_1",
    });
  });

  it("adapts Node requests and responses to the existing Vercel handler contract", async () => {
    const request = createRequest({
      method: "POST",
      url: "/api/clients/client_1?include=notes",
      body: JSON.stringify({ firstName: "Ana" }),
    });
    const response = createResponse();
    const handler = vi.fn((request, response) => {
      response.status(201).json({
        body: request.body,
        query: request.query,
      });
    });

    await expect(
      invokeApiRoute({
        request,
        response,
        loadModule: async () => ({ default: handler }),
      }),
    ).resolves.toBe(true);

    expect(handler).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(201);
    expect(response.body).toEqual({
      body: { firstName: "Ana" },
      query: { include: "notes", id: "client_1" },
    });
  });

  it("parses comma-separated CORS origins from the environment", () => {
    vi.stubEnv(
      "CORS_ORIGIN",
      "https://clipper.vercel.app, https://preview.vercel.app",
    );

    expect(getAllowedOrigins()).toEqual([
      "https://clipper.vercel.app",
      "https://preview.vercel.app",
    ]);

    vi.unstubAllEnvs();
  });
});

function createRequest({
  method,
  url,
  body = "",
}: {
  method: string;
  url: string;
  body?: string;
}) {
  return Object.assign(Readable.from(body ? [body] : []), {
    method,
    url,
    headers: { "content-type": "application/json" },
  }) as IncomingMessage;
}

function createResponse() {
  const headers = new Map<string, string>();
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    writableEnded: false,
    setHeader(name: string, value: string) {
      headers.set(name.toLowerCase(), value);
      return this;
    },
    hasHeader(name: string) {
      return headers.has(name.toLowerCase());
    },
    end(body?: string) {
      this.body = body ? JSON.parse(body) : undefined;
      this.writableEnded = true;
      return this;
    },
  };

  return response as ServerResponse & typeof response;
}
