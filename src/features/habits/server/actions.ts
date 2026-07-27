"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import {
  aiSuggestHabitsSchema,
  createHabitSchema,
  toggleCheckInSchema,
  updateHabitSchema,
} from "../schemas";
import type { HabitDto, HabitSuggestionDto, HabitWithStatsDto } from "../types";
import { suggestHabits } from "./ai";
import { archiveHabit, createHabit, toggleCheckIn, updateHabit } from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "habits-write", limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "habits-ai", limit: 5, windowSeconds: 300 });
  return aiLimiter;
}

const idSchema = z.string().cuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) return { ok: false, error: error.message };
  console.error("[habits] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateHabitViews(): void {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many requests — give it a moment." };
  return { userId };
}

export async function createHabitAction(input: unknown): Promise<ActionResult<HabitDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createHabitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const habit = await createHabit(ctx.userId, parsed.data);
    revalidateHabitViews();
    return { ok: true, data: habit };
  } catch (error) {
    return failure(error);
  }
}

export async function updateHabitAction(input: unknown): Promise<ActionResult<HabitWithStatsDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateHabitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const habit = await updateHabit(ctx.userId, parsed.data);
    revalidateHabitViews();
    return { ok: true, data: habit };
  } catch (error) {
    return failure(error);
  }
}

export async function archiveHabitAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid habit id." };

  try {
    await archiveHabit(ctx.userId, parsed.data);
    revalidateHabitViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleCheckInAction(
  input: unknown,
): Promise<ActionResult<{ completedToday: boolean }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = toggleCheckInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const result = await toggleCheckIn(ctx.userId, parsed.data.habitId, parsed.data.date);
    revalidateHabitViews();
    return { ok: true, data: result };
  } catch (error) {
    return failure(error);
  }
}

/** Read-only: returns suggestions for the review dialog. */
export async function suggestHabitsAction(
  input: unknown,
): Promise<ActionResult<HabitSuggestionDto[]>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = aiSuggestHabitsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const suggestions = await suggestHabits(parsed.data.goal);
    return { ok: true, data: suggestions };
  } catch (error) {
    return failure(error);
  }
}
