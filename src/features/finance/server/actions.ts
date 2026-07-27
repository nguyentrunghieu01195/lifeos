"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import {
  aiCategorizeSchema,
  applyCategoriesSchema,
  createCategorySchema,
  createTransactionSchema,
  setBudgetSchema,
  updateTransactionSchema,
} from "../schemas";
import type { BudgetDto, CategoryDto, CategorySuggestionDto, TransactionDto } from "../types";
import { suggestCategories } from "./ai";
import {
  applyCategoryAssignments,
  createCategory,
  createStarterCategories,
  createTransaction,
  deleteTransaction,
  setBudget,
  updateTransaction,
} from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "finance-write", limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "finance-ai", limit: 10, windowSeconds: 300 });
  return aiLimiter;
}

const idSchema = z.string().cuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) {
    return { ok: false, error: error.message };
  }
  console.error("[finance] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateFinanceViews(): void {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many changes in a short time — give it a moment." };
  return { userId };
}

export async function createTransactionAction(
  input: unknown,
): Promise<ActionResult<TransactionDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const transaction = await createTransaction(ctx.userId, parsed.data);
    revalidateFinanceViews();
    return { ok: true, data: transaction };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTransactionAction(
  input: unknown,
): Promise<ActionResult<TransactionDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateTransactionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const transaction = await updateTransaction(ctx.userId, parsed.data);
    revalidateFinanceViews();
    return { ok: true, data: transaction };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTransactionAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid transaction id." };

  try {
    await deleteTransaction(ctx.userId, parsed.data);
    revalidateFinanceViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function createCategoryAction(input: unknown): Promise<ActionResult<CategoryDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const category = await createCategory(ctx.userId, parsed.data);
    revalidateFinanceViews();
    return { ok: true, data: category };
  } catch (error) {
    return failure(error);
  }
}

export async function createStarterCategoriesAction(): Promise<ActionResult<CategoryDto[]>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  try {
    const categories = await createStarterCategories(ctx.userId);
    revalidateFinanceViews();
    return { ok: true, data: categories };
  } catch (error) {
    return failure(error);
  }
}

export async function setBudgetAction(input: unknown): Promise<ActionResult<BudgetDto | null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = setBudgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const budget = await setBudget(ctx.userId, parsed.data);
    revalidateFinanceViews();
    return { ok: true, data: budget };
  } catch (error) {
    return failure(error);
  }
}

/** Read-only: returns suggestions for the review dialog. Writes nothing. */
export async function aiCategorizeAction(
  input: unknown,
): Promise<ActionResult<CategorySuggestionDto[]>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = aiCategorizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const suggestions = await suggestCategories(ctx.userId, parsed.data.transactionIds);
    return { ok: true, data: suggestions };
  } catch (error) {
    return failure(error);
  }
}

export async function applyCategoriesAction(
  input: unknown,
): Promise<ActionResult<{ applied: number }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = applyCategoriesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const applied = await applyCategoryAssignments(ctx.userId, parsed.data.assignments);
    revalidateFinanceViews();
    return { ok: true, data: { applied } };
  } catch (error) {
    return failure(error);
  }
}
