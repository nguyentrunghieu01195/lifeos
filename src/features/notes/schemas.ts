import { z } from "zod";

import { REWRITE_TONES } from "./types";

/** A Tiptap document: `{ type: "doc", content?: [...] }`, size-capped. */
export const tiptapDocSchema = z
  .object({ type: z.literal("doc") })
  .passthrough()
  .refine((doc) => JSON.stringify(doc).length <= 400_000, {
    message: "This note is too large — split it into smaller notes.",
  });

export const createNoteSchema = z.object({
  folderId: z.string().cuid().nullish(),
});

export const updateNoteSchema = z.object({
  id: z.string().cuid(),
  title: z.string().trim().max(200).optional(),
  content: tiptapDocSchema.optional(),
  contentText: z.string().max(100_000).optional(),
  folderId: z.string().cuid().nullable().optional(),
  tagIds: z.array(z.string().cuid()).max(20).optional(),
});

export const createFolderSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
});

export const rewriteSchema = z.object({
  text: z
    .string()
    .trim()
    .min(10, "Select at least a sentence to rewrite.")
    .max(4000, "Select a smaller passage (under 4000 characters)."),
  tone: z.enum(REWRITE_TONES),
});

export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
