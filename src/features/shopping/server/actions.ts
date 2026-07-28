"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import {
  addItemSchema,
  bulkAddItemsSchema,
  createListSchema,
  suggestItemsSchema,
  updateItemSchema,
  updateListSchema,
} from "../schemas";
import type { ItemSuggestionDto, ShoppingItemDto, ShoppingListDto } from "../types";
import { suggestShoppingItems } from "./ai";
import {
  addItem,
  archiveShoppingList,
  bulkAddItems,
  createShoppingList,
  deleteItem,
  getListContext,
  resetShoppingList,
  toggleItem,
  updateItem,
  updateShoppingList,
} from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "shopping-write", limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "shopping-ai", limit: 10, windowSeconds: 300 });
  return aiLimiter;
}

const idSchema = z.string().cuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) return { ok: false, error: error.message };
  console.error("[shopping] unexpected error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidate(listId?: string): void {
  revalidatePath("/shopping");
  if (listId) revalidatePath(`/shopping/${listId}`);
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many requests — give it a moment." };
  return { userId };
}

export async function createListAction(input: unknown): Promise<ActionResult<ShoppingListDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = createListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const list = await createShoppingList(ctx.userId, parsed.data);
    revalidate();
    return { ok: true, data: list };
  } catch (error) {
    return failure(error);
  }
}

export async function updateListAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = updateListSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await updateShoppingList(ctx.userId, parsed.data.id, {
      name: parsed.data.name,
      description: parsed.data.description,
    });
    revalidate(parsed.data.id);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveListAction(id: unknown): Promise<ActionResult<null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid list id." };
  try {
    await archiveShoppingList(ctx.userId, parsed.data);
    revalidate(parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function resetListAction(id: unknown): Promise<ActionResult<null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid list id." };
  try {
    await resetShoppingList(ctx.userId, parsed.data);
    revalidate(parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function addItemAction(input: unknown): Promise<ActionResult<ShoppingItemDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = addItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const item = await addItem(ctx.userId, parsed.data);
    revalidate(parsed.data.listId);
    return { ok: true, data: item };
  } catch (error) {
    return failure(error);
  }
}

export async function updateItemAction(input: unknown): Promise<ActionResult<ShoppingItemDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const item = await updateItem(ctx.userId, parsed.data);
    return { ok: true, data: item };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleItemAction(id: unknown): Promise<ActionResult<{ isChecked: boolean }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid item id." };
  try {
    const isChecked = await toggleItem(ctx.userId, parsed.data);
    revalidatePath("/dashboard"); // update dashboard widget
    return { ok: true, data: { isChecked } };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteItemAction(id: unknown): Promise<ActionResult<null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid item id." };
  try {
    await deleteItem(ctx.userId, parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}

export async function suggestItemsAction(
  input: unknown,
): Promise<ActionResult<ItemSuggestionDto[]>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = suggestItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const context = await getListContext(ctx.userId, parsed.data.listId);
    const suggestions = await suggestShoppingItems(
      context.name,
      context.description,
      context.existingItems,
      parsed.data.prompt,
    );
    return { ok: true, data: suggestions };
  } catch (error) {
    return failure(error);
  }
}

export async function bulkAddItemsAction(input: unknown): Promise<ActionResult<null>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = bulkAddItemsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    await bulkAddItems(ctx.userId, parsed.data.listId, parsed.data.items);
    revalidate(parsed.data.listId);
    return { ok: true, data: null };
  } catch (error) {
    return failure(error);
  }
}
