import { z } from "zod";

import { isMonthKey, MAX_AMOUNT_MINOR } from "./lib/money";

const transactionType = z.enum(["INCOME", "EXPENSE"]);

const amountMinor = z
  .number()
  .int("Amounts are whole đồng.")
  .positive("Amount must be positive.")
  .max(MAX_AMOUNT_MINOR, "That amount looks too large.");

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

export const monthKeySchema = z
  .string()
  .refine(isMonthKey, { message: "Invalid month — expected YYYY-MM." });

export const createTransactionSchema = z.object({
  type: transactionType,
  amountMinor,
  note: z.string().trim().max(200).default(""),
  date: dateOnly,
  categoryId: z.string().cuid().nullish(),
});

export const updateTransactionSchema = z.object({
  id: z.string().cuid(),
  type: transactionType.optional(),
  amountMinor: amountMinor.optional(),
  note: z.string().trim().max(200).optional(),
  date: dateOnly.optional(),
  categoryId: z.string().cuid().nullable().optional(),
});

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  type: transactionType,
  icon: z.string().trim().min(1).max(8).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Invalid color.")
    .optional(),
});

export const setBudgetSchema = z.object({
  /** Null targets the overall monthly budget. */
  categoryId: z.string().cuid().nullable(),
  month: monthKeySchema,
  /** 0 removes the budget. */
  amountMinor: z.number().int().min(0).max(MAX_AMOUNT_MINOR),
});

export const aiCategorizeSchema = z.object({
  transactionIds: z.array(z.string().cuid()).min(1).max(20),
});

export const applyCategoriesSchema = z.object({
  assignments: z
    .array(
      z.object({
        transactionId: z.string().cuid(),
        categoryId: z.string().cuid(),
      }),
    )
    .min(1)
    .max(20),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type SetBudgetInput = z.infer<typeof setBudgetSchema>;
