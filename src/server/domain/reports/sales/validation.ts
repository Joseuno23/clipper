import { z } from "zod";

import { parseWithSchema } from "../../../api/validation";
import type { SalesReportInput } from "./types";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const querySchema = z
  .object({
    from: dateSchema,
    to: dateSchema,
    itemType: z.enum(["all", "SERVICE", "PRODUCT"]).default("all"),
    serviceId: z.string().min(1).default("all"),
    productId: z.string().min(1).default("all"),
  })
  .refine((value) => value.from <= value.to, {
    message: "The from date must be before or equal to the to date.",
    path: ["from"],
  });

export function parseSalesReportInput(input: unknown): SalesReportInput {
  const parsed = parseWithSchema(querySchema, input);
  return {
    from: parsed.from,
    to: parsed.to,
    itemType: parsed.itemType ?? "all",
    serviceId: parsed.serviceId === "all" ? "all" : (parsed.serviceId ?? "all"),
    productId: parsed.productId === "all" ? "all" : (parsed.productId ?? "all"),
  };
}
