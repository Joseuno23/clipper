export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "METHOD_NOT_ALLOWED"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

const statusByCode: Record<ApiErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
};

type ApiErrorOptions = {
  code: ApiErrorCode;
  message: string;
  status?: number;
  details?: unknown;
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;
  readonly status: number;

  constructor({ code, message, status, details }: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status ?? statusByCode[code];
  }
}

export type SerializedApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export function methodNotAllowed(allowedMethods: readonly string[]) {
  return new ApiError({
    code: "METHOD_NOT_ALLOWED",
    message: `Method not allowed. Supported methods: ${allowedMethods.join(", ")}`,
    status: 405,
    details: { allowedMethods },
  });
}

export function serializeApiError(error: unknown): {
  status: number;
  error: SerializedApiError;
} {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }

  return {
    status: 500,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred.",
    },
  };
}
