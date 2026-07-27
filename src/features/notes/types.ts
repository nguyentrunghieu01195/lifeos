import type { TagDto } from "@/features/tasks/types";

export type { ActionResult } from "@/types/actions";
export type { TagDto };

export interface NoteFolderDto {
  id: string;
  name: string;
}

/** List projection — no content payload. */
export interface NoteListItemDto {
  id: string;
  title: string;
  preview: string;
  folderId: string | null;
  folder: NoteFolderDto | null;
  tags: TagDto[];
  updatedAt: string;
}

/** Full note for the editor. `content` is a Tiptap JSON document. */
export interface NoteDetailDto extends NoteListItemDto {
  content: unknown;
  createdAt: string;
}

export const REWRITE_TONES = ["clearer", "shorter", "more professional", "friendlier"] as const;
export type RewriteTone = (typeof REWRITE_TONES)[number];
