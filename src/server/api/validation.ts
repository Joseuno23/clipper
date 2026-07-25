import { z } from "zod";

import { ApiError } from "./errors";

export type FieldValidationIssue = {
  field: string;
  message: string;
};

export function parseWithSchema<T>(schema: z.Schema<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (result.success) {
    return result.data;
  }

  throw new ApiError({
    code: "BAD_REQUEST",
    message: "Request validation failed.",
    details: {
      fields: result.error.issues.map((issue): FieldValidationIssue => {
        const field = issue.path.join(".") || "body";

        return { field, message: issue.message };
      }),
    },
  });
}
