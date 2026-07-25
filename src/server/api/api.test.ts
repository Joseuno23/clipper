// @vitest-environment node
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it } from "vitest";

import healthHandler from "../../../api/health";
import { ApiError, serializeApiError } from "./errors";
import { createApiHandler } from "./handler";
import { getBearerToken, parseJsonBody } from "./request";
import { sendFailure, sendSuccess } from "./response";

function createResponse() {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status(status: number) {
      this.statusCode = status;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };

  return response as VercelResponse & typeof response;
}

function createRequest(overrides: Partial<VercelRequest> = {}) {
  return {
    method: "GET",
    ...overrides,
  } as VercelRequest;
}

describe("API response envelopes", () => {
  it("sends normalized success envelopes", () => {
    const response = createResponse();

    sendSuccess(response, { status: "ok" });

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({ ok: true, data: { status: "ok" } });
  });

  it("sends normalized failure envelopes", () => {
    const response = createResponse();

    sendFailure(response, 400, {
      code: "BAD_REQUEST",
      message: "Invalid request.",
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      ok: false,
      error: { code: "BAD_REQUEST", message: "Invalid request." },
    });
  });
});

describe("API error serialization", () => {
  it("preserves typed API errors", () => {
    expect(
      serializeApiError(
        new ApiError({
          code: "BAD_REQUEST",
          message: "Missing body.",
          details: { field: "body" },
        }),
      ),
    ).toEqual({
      status: 400,
      error: {
        code: "BAD_REQUEST",
        message: "Missing body.",
        details: { field: "body" },
      },
    });
  });

  it("hides unknown error details", () => {
    expect(serializeApiError(new Error("database exploded"))).toEqual({
      status: 500,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
  });
});

describe("API method guard", () => {
  it("returns a method error for unsupported methods", async () => {
    const handler = createApiHandler({
      methods: ["GET"],
      handle: () => ({ ok: true }),
    });
    const response = createResponse();

    await handler(createRequest({ method: "POST" }), response);

    expect(response.statusCode).toBe(405);
    expect(response.body).toEqual({
      ok: false,
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Method not allowed. Supported methods: GET",
        details: { allowedMethods: ["GET"] },
      },
    });
  });
});

describe("API request parsing", () => {
  it("parses string JSON bodies", () => {
    expect(
      parseJsonBody(createRequest({ body: '{"name":"Clipper"}' })),
    ).toEqual({
      name: "Clipper",
    });
  });

  it("rejects missing bodies", () => {
    expect(() => parseJsonBody(createRequest({ body: undefined }))).toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Request body is required.",
      }),
    );
  });

  it("rejects malformed JSON bodies", () => {
    expect(() => parseJsonBody(createRequest({ body: "{" }))).toThrow(
      new ApiError({
        code: "BAD_REQUEST",
        message: "Request body must be valid JSON.",
      }),
    );
  });
});

describe("API bearer token parsing", () => {
  it("extracts a bearer token", () => {
    expect(getBearerToken({ authorization: "Bearer jwt_1" })).toBe("jwt_1");
  });

  it("rejects missing bearer tokens", () => {
    expect(() => getBearerToken({})).toThrow(
      new ApiError({
        code: "UNAUTHENTICATED",
        message: "Authorization Bearer token is required.",
      }),
    );
  });

  it("rejects malformed authorization headers", () => {
    expect(() => getBearerToken({ authorization: "Basic jwt_1" })).toThrow(
      new ApiError({
        code: "UNAUTHENTICATED",
        message: "Authorization header must use Bearer token format.",
      }),
    );
  });
});

describe("health API handler", () => {
  it("returns a successful health envelope", async () => {
    const response = createResponse();

    await healthHandler(createRequest(), response);

    expect(response.statusCode).toBe(200);
    expect(response.body).toEqual({
      ok: true,
      data: { status: "ok", service: "clipper-api" },
    });
  });
});
