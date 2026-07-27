"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

import {
  aiGenerateSchema,
  createProjectSchema,
  createSubtaskSchema,
  createTagSchema,
  createTaskSchema,
  moveTaskSchema,
  updateTaskSchema,
} from "../schemas";
import type { ActionResult, ProjectDto, TagDto, TaskDto } from "../types";
import { generateTasksFromPrompt } from "./ai";
import {
  createProject,
  createSubtask,
  createTag,
  createTask,
  deleteTask,
  moveTask,
  toggleTask,
  updateTask,
} from "./service";

/**
 * Task server actions: session → zod → rate limit → ownership-scoped service.
 * Every action returns a typed ActionResult; unexpected errors surface a
 * generic message and are logged server-side.
 */

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  writeLimiter ??= createRateLimiter({ name: "tasks-write", limit: 120, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "tasks-ai", limit: 10, windowSeconds: 300 });
  return aiLimiter;
}

const idSchema = z.string().cuid();

const NOT_SIGNED_IN = "You need to be signed in.";
const RATE_LIMITED = "Too many changes in a short time — give it a moment.";

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) {
    return { ok: false, error: error.message };
  }
  console.error("[tasks] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateTaskViews(): void {
  revalidatePath("/tasks");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: NOT_SIGNED_IN };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: RATE_LIMITED };
  return { userId };
}

export async function createTaskAction(input: unknown): Promise<ActionResult<TaskDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const task = await createTask(ctx.userId, parsed.data);
    revalidateTaskViews();
    return { ok: true, data: task };
  } catch (error) {
    return failure(error);
  }
}

export async function updateTaskAction(input: unknown): Promise<ActionResult<TaskDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const task = await updateTask(ctx.userId, parsed.data);
    revalidateTaskViews();
    return { ok: true, data: task };
  } catch (error) {
    return failure(error);
  }
}

export async function toggleTaskAction(id: unknown): Promise<ActionResult<TaskDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid task id." };

  try {
    const task = await toggleTask(ctx.userId, parsed.data);
    revalidateTaskViews();
    return { ok: true, data: task };
  } catch (error) {
    return failure(error);
  }
}

export async function moveTaskAction(input: unknown): Promise<ActionResult<TaskDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = moveTaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const task = await moveTask(ctx.userId, parsed.data);
    revalidateTaskViews();
    return { ok: true, data: task };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteTaskAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid task id." };

  try {
    await deleteTask(ctx.userId, parsed.data);
    revalidateTaskViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function createSubtaskAction(input: unknown): Promise<ActionResult<TaskDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createSubtaskSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const task = await createSubtask(ctx.userId, parsed.data.parentId, parsed.data.title);
    revalidateTaskViews();
    return { ok: true, data: task };
  } catch (error) {
    return failure(error);
  }
}

export async function createProjectAction(input: unknown): Promise<ActionResult<ProjectDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const project = await createProject(ctx.userId, parsed.data.name, parsed.data.color);
    revalidateTaskViews();
    return { ok: true, data: project };
  } catch (error) {
    return failure(error);
  }
}

export async function createTagAction(input: unknown): Promise<ActionResult<TagDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createTagSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const tag = await createTag(ctx.userId, parsed.data.name, parsed.data.color);
    revalidateTaskViews();
    return { ok: true, data: tag };
  } catch (error) {
    return failure(error);
  }
}

export async function generateTasksAction(input: unknown): Promise<ActionResult<TaskDto[]>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = aiGenerateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const tasks = await generateTasksFromPrompt(ctx.userId, parsed.data.prompt);
    revalidateTaskViews();
    return { ok: true, data: tasks };
  } catch (error) {
    return failure(error);
  }
}
