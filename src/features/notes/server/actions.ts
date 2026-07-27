"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import { createFolderSchema, createNoteSchema, rewriteSchema, updateNoteSchema } from "../schemas";
import type { NoteDetailDto, NoteFolderDto, NoteListItemDto } from "../types";
import { rewriteText, summarizeNote } from "./ai";
import { createFolder, createNote, deleteNote, updateNote } from "./service";

let writeLimiter: RateLimiter | null = null;
let aiLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  // Autosave-friendly budget: one save every ~500ms sustained.
  writeLimiter ??= createRateLimiter({ name: "notes-write", limit: 120, windowSeconds: 60 });
  return writeLimiter;
}

function getAiLimiter(): RateLimiter {
  aiLimiter ??= createRateLimiter({ name: "notes-ai", limit: 10, windowSeconds: 300 });
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
  console.error("[notes] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

function revalidateNoteViews(): void {
  revalidatePath("/notes");
  revalidatePath("/dashboard");
}

async function guard(limiter: RateLimiter): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await limiter.limit(userId);
  if (!limit.success) return { error: "Too many changes in a short time — give it a moment." };
  return { userId };
}

export async function createNoteAction(input?: unknown): Promise<ActionResult<NoteDetailDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createNoteSchema.safeParse(input ?? {});
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const note = await createNote(ctx.userId, parsed.data.folderId);
    revalidateNoteViews();
    return { ok: true, data: note };
  } catch (error) {
    return failure(error);
  }
}

export async function updateNoteAction(input: unknown): Promise<ActionResult<NoteListItemDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const note = await updateNote(ctx.userId, parsed.data);
    revalidateNoteViews();
    return { ok: true, data: note };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteNoteAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid note id." };

  try {
    await deleteNote(ctx.userId, parsed.data);
    revalidateNoteViews();
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}

export async function createNoteFolderAction(input: unknown): Promise<ActionResult<NoteFolderDto>> {
  const ctx = await guard(getWriteLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createFolderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const folder = await createFolder(ctx.userId, parsed.data.name);
    revalidateNoteViews();
    return { ok: true, data: folder };
  } catch (error) {
    return failure(error);
  }
}

export async function summarizeNoteAction(id: unknown): Promise<ActionResult<{ summary: string }>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid note id." };

  try {
    const summary = await summarizeNote(ctx.userId, parsed.data);
    return { ok: true, data: { summary } };
  } catch (error) {
    return failure(error);
  }
}

export async function rewriteTextAction(
  input: unknown,
): Promise<ActionResult<{ rewritten: string }>> {
  const ctx = await guard(getAiLimiter());
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = rewriteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const rewritten = await rewriteText(parsed.data.text, parsed.data.tone);
    return { ok: true, data: { rewritten } };
  } catch (error) {
    return failure(error);
  }
}
