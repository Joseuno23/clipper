import { z } from "zod";

import { parseWithSchema } from "../../../api/validation";
import type { StaffLiquidationInput } from "./types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    staffMemberId: z.string().min(1).default("all"),
  })
  .refine((value) => value.from <= value.to, {
    message: "The from date must be before or equal to the to date.",
    path: ["from"],
  });

export function parseStaffLiquidationInput(
  input: unknown,
): StaffLiquidationInput {
  const parsed = parseWithSchema(querySchema, input);
  return {
    from: parsed.from,
    to: parsed.to,
    staffMemberId:
      parsed.staffMemberId === "all" ? "all" : (parsed.staffMemberId ?? "all"),
  };
}
