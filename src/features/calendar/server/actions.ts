"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import {
  aiScheduleSchema,
  createEventSchema,
  moveEventSchema,
  updateEventSchema,
} from "../schemas";
import type { EventDto } from "../types";
import { scheduleEventsFromPrompt } from "./ai";
import { createEvent, deleteEvent, moveEvent, updateEvent } from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "calendar-write", limit: 120, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "calendar-ai", limit: 10, windowSeconds: 300 });
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
  console.error("[calendar] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateCalendarViews(): void {
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many changes in a short time — give it a moment." };
  return { userId };
}

export async function createEventAction(input: unknown): Promise<ActionResult<EventDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const event = await createEvent(ctx.userId, parsed.data);
    revalidateCalendarViews();
    return { ok: true, data: event };
  } catch (error) {
    return failure(error);
  }
}

export async function updateEventAction(input: unknown): Promise<ActionResult<EventDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const event = await updateEvent(ctx.userId, parsed.data);
    revalidateCalendarViews();
    return { ok: true, data: event };
  } catch (error) {
    return failure(error);
  }
}

export async function moveEventAction(input: unknown): Promise<ActionResult<EventDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = moveEventSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const event = await moveEvent(ctx.userId, parsed.data);
    revalidateCalendarViews();
    return { ok: true, data: event };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteEventAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid event id." };

  try {
    await deleteEvent(ctx.userId, parsed.data);
    revalidateCalendarViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function scheduleWithAIAction(input: unknown): Promise<ActionResult<EventDto[]>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = aiScheduleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const events = await scheduleEventsFromPrompt(ctx.userId, parsed.data);
    revalidateCalendarViews();
    return { ok: true, data: events };
  } catch (error) {
    return failure(error);
  }
}
