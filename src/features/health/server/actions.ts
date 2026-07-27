"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import { logSleepSchema, logWaterSchema, logWeightSchema, logWorkoutSchema } from "../schemas";
import type { SleepLogDto, WaterLogDto, WeightLogDto, WorkoutLogDto } from "../types";
import { analyzeHealth } from "./ai";
import {
  deleteSleepLog,
  deleteWaterLog,
  deleteWeightLog,
  deleteWorkoutLog,
  logSleep,
  logWater,
  logWeight,
  logWorkout,
} from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "health-write", limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "health-ai", limit: 5, windowSeconds: 300 });
  return aiLimiter;
}

const idSchema = z.string().cuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) return { ok: false, error: error.message };
  console.error("[health] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateViews(): void {
  revalidatePath("/health");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many requests — give it a moment." };
  return { userId };
}

export async function logWeightAction(input: unknown): Promise<ActionResult<WeightLogDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = logWeightSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const log = await logWeight(ctx.userId, parsed.data);
    revalidateViews();
    return { ok: true, data: log };
  } catch (error) {
    return failure(error);
  }
}

export async function logSleepAction(input: unknown): Promise<ActionResult<SleepLogDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = logSleepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const log = await logSleep(ctx.userId, parsed.data);
    revalidateViews();
    return { ok: true, data: log };
  } catch (error) {
    return failure(error);
  }
}

export async function logWaterAction(input: unknown): Promise<ActionResult<WaterLogDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = logWaterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const log = await logWater(ctx.userId, parsed.data);
    revalidateViews();
    return { ok: true, data: log };
  } catch (error) {
    return failure(error);
  }
}

export async function logWorkoutAction(input: unknown): Promise<ActionResult<WorkoutLogDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = logWorkoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  try {
    const log = await logWorkout(ctx.userId, parsed.data);
    revalidateViews();
    return { ok: true, data: log };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteHealthLogAction(
  type: "weight" | "sleep" | "water" | "workout",
  id: unknown,
): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid id." };
  try {
    if (type === "weight") await deleteWeightLog(ctx.userId, parsed.data);
    else if (type === "sleep") await deleteSleepLog(ctx.userId, parsed.data);
    else if (type === "water") await deleteWaterLog(ctx.userId, parsed.data);
    else await deleteWorkoutLog(ctx.userId, parsed.data);
    revalidateViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function analyzeHealthAction(): Promise<ActionResult<{ analysis: string }>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };
  try {
    const analysis = await analyzeHealth(ctx.userId);
    return { ok: true, data: { analysis } };
  } catch (error) {
    return failure(error);
  }
}
