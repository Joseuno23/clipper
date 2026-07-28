import { z } from "zod";

import { PaymentMethod } from "../../../generated/prisma/enums";
import { parseWithSchema } from "../../api/validation";
import type {
  SaleCreateInput,
  SaleCancelInput,
  SaleListInput,
  SalePaymentInput,
  SaleUpdateInput,
} from "./types";

const listSchema = z.object({
  status: z.enum(["open", "closed", "cancelled", "all"]).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

const createSchema = z.object({
  clientId: z.string().min(1).nullable().optional(),
  staffMemberId: z.string().min(1).nullable().optional(),
});

const updateSchema = z.union([
  z.object({
    action: z.literal("addItem"),
    kind: z.literal("SERVICE"),
    serviceId: z.string().min(1),
    quantity: z.coerce
      .number()
      .int()
      .min(1)
      .refine((quantity) => quantity === 1, {
        message: "Service sale items must have quantity 1.",
      })
      .default(1),
  }),
  z.object({
    action: z.literal("addItem"),
    kind: z.literal("PRODUCT"),
    productId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).default(1),
  }),
  z.object({
    action: z.literal("removeItem"),
    itemId: z.string().min(1),
  }),
  z.object({
    action: z.literal("updateItemQuantity"),
    itemId: z.string().min(1),
    quantity: z.coerce.number().int().min(1),
  }),
]);

const paymentSchema = z.object({
  method: z.nativeEnum(PaymentMethod).default(PaymentMethod.TRANSFER),
  reference: z.string().trim().min(1).nullable().optional(),
});

const cancelSchema = z.object({
  reason: z.string().trim().min(1, "Cancellation reason is required."),
});

export function parseSaleListInput(input: unknown): SaleListInput {
  return parseWithSchema(listSchema, input);
}

export function parseSaleCreateInput(input: unknown): SaleCreateInput {
  return parseWithSchema(createSchema, input);
}

export function parseSaleUpdateInput(input: unknown): SaleUpdateInput {
  return parseWithSchema(updateSchema, input);
}

export function parseSalePaymentInput(input: unknown): SalePaymentInput {
  return parseWithSchema(paymentSchema, input);
}

export function parseSaleCancelInput(input: unknown): SaleCancelInput {
  return parseWithSchema(cancelSchema, input);
}
