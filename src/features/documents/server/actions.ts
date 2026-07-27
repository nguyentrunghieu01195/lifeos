"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";
import type { ActionResult } from "@/types/actions";

import { createUploadSchema, renameDocumentSchema } from "../schemas";
import type { DocumentDto, UploadTicket } from "../types";
import { createUpload, deleteDocument, finalizeUpload, renameDocument } from "./service";

let writeLimiter: RateLimiter | null = null;

function getWriteLimiter(): RateLimiter {
  // Two calls per uploaded file (create + finalize) — 60/min covers bursts.
  writeLimiter ??= createRateLimiter({ name: "documents-write", limit: 60, windowSeconds: 60 });
  return writeLimiter;
}

const idSchema = z.string().cuid();

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}

function failure(error: unknown): { ok: false; error: string } {
  if (isAppError(error)) {
    return { ok: false, error: error.message };
  }
  console.error("[documents] unexpected action error:", error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

async function guard(): Promise<{ userId: string } | { error: string }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "You need to be signed in." };
  const limit = await getWriteLimiter().limit(userId);
  if (!limit.success) return { error: "Too many file operations — give it a moment." };
  return { userId };
}

export async function createUploadAction(input: unknown): Promise<ActionResult<UploadTicket>> {
  const ctx = await guard();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = createUploadSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const ticket = await createUpload(ctx.userId, parsed.data);
    return { ok: true, data: ticket };
  } catch (error) {
    return failure(error);
  }
}

export async function finalizeUploadAction(id: unknown): Promise<ActionResult<DocumentDto>> {
  const ctx = await guard();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid document id." };

  try {
    const document = await finalizeUpload(ctx.userId, parsed.data);
    revalidatePath("/documents");
    return { ok: true, data: document };
  } catch (error) {
    return failure(error);
  }
}

export async function renameDocumentAction(input: unknown): Promise<ActionResult<DocumentDto>> {
  const ctx = await guard();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = renameDocumentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  try {
    const document = await renameDocument(ctx.userId, parsed.data.id, parsed.data.name);
    revalidatePath("/documents");
    return { ok: true, data: document };
  } catch (error) {
    return failure(error);
  }
}

export async function deleteDocumentAction(id: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await guard();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return { ok: false, error: "Invalid document id." };

  try {
    await deleteDocument(ctx.userId, parsed.data);
    revalidatePath("/documents");
    return { ok: true, data: { id: parsed.data } };
  } catch (error) {
    return failure(error);
  }
}
