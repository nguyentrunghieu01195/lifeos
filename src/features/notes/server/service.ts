import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import type { UpdateNoteInput } from "../schemas";
import type { NoteDetailDto, NoteFolderDto, NoteListItemDto } from "../types";

/** Notes domain service — every read/write is scoped to the explicit userId. */

const EMPTY_DOC = { type: "doc", content: [{ type: "paragraph" }] };
const PREVIEW_LENGTH = 180;

const listSelect = {
  id: true,
  title: true,
  contentText: true,
  folderId: true,
  updatedAt: true,
  folder: { select: { id: true, name: true } },
  tags: { select: { id: true, name: true, color: true } },
};

type NoteListRecord = {
  id: string;
  title: string;
  contentText: string;
  folderId: string | null;
  updatedAt: Date;
  folder: NoteFolderDto | null;
  tags: Array<{ id: string; name: string; color: string }>;
};

export function previewOf(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > PREVIEW_LENGTH ? `${collapsed.slice(0, PREVIEW_LENGTH)}…` : collapsed;
}

function toListItem(note: NoteListRecord): NoteListItemDto {
  return {
    id: note.id,
    title: note.title,
    preview: previewOf(note.contentText),
    folderId: note.folderId,
    folder: note.folder,
    tags: note.tags,
    updatedAt: note.updatedAt.toISOString(),
  };
}

export async function listNotes(userId: string): Promise<NoteListItemDto[]> {
  const notes = await getDb().note.findMany({
    where: { userId },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
  });
  return (notes as NoteListRecord[]).map(toListItem);
}

export async function listFolders(userId: string): Promise<NoteFolderDto[]> {
  return getDb().noteFolder.findMany({
    where: { userId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getNote(userId: string, id: string): Promise<NoteDetailDto> {
  const note = await getDb().note.findFirst({
    where: { id, userId },
    select: { ...listSelect, content: true, createdAt: true },
  });
  if (!note) {
    throw new AppError("Note not found.", { code: "NOT_FOUND", status: 404 });
  }
  return {
    ...toListItem(note as NoteListRecord),
    content: note.content,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function createNote(userId: string, folderId?: string | null): Promise<NoteDetailDto> {
  if (folderId) {
    await assertOwnedFolder(userId, folderId);
  }
  const note = await getDb().note.create({
    data: { userId, folderId: folderId ?? null, content: EMPTY_DOC },
    select: { ...listSelect, content: true, createdAt: true },
  });
  return {
    ...toListItem(note as NoteListRecord),
    content: note.content,
    createdAt: note.createdAt.toISOString(),
  };
}

export async function updateNote(userId: string, input: UpdateNoteInput): Promise<NoteListItemDto> {
  const existing = await getDb().note.findFirst({ where: { id: input.id, userId } });
  if (!existing) {
    throw new AppError("Note not found.", { code: "NOT_FOUND", status: 404 });
  }
  if (input.folderId) {
    await assertOwnedFolder(userId, input.folderId);
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title || "Untitled";
  if (input.content !== undefined) data.content = toPlainJson(input.content);
  if (input.contentText !== undefined) data.contentText = input.contentText;
  if (input.folderId !== undefined) data.folderId = input.folderId;
  if (input.tagIds !== undefined) {
    const tags = await getDb().tag.findMany({
      where: { userId, id: { in: input.tagIds } },
      select: { id: true },
    });
    data.tags = { set: tags.map((tag) => ({ id: tag.id })) };
  }

  const note = await getDb().note.update({
    where: { id: input.id },
    data,
    select: listSelect,
  });
  return toListItem(note as NoteListRecord);
}

export async function deleteNote(userId: string, id: string): Promise<void> {
  const result = await getDb().note.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new AppError("Note not found.", { code: "NOT_FOUND", status: 404 });
  }
}

export async function createFolder(userId: string, name: string): Promise<NoteFolderDto> {
  try {
    return await getDb().noteFolder.create({
      data: { userId, name },
      select: { id: true, name: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("A folder with this name already exists.", {
        code: "VALIDATION",
        status: 409,
      });
    }
    throw error;
  }
}

/** Reads the plain text of an owned note (for AI summarize). */
export async function getNoteText(userId: string, id: string): Promise<string> {
  const note = await getDb().note.findFirst({
    where: { id, userId },
    select: { contentText: true },
  });
  if (!note) {
    throw new AppError("Note not found.", { code: "NOT_FOUND", status: 404 });
  }
  return note.contentText;
}

/** Dashboard widget data. */
export async function getRecentNotes(userId: string, take = 3): Promise<NoteListItemDto[]> {
  const notes = await getDb().note.findMany({
    where: { userId },
    select: listSelect,
    orderBy: { updatedAt: "desc" },
    take,
  });
  return (notes as NoteListRecord[]).map(toListItem);
}

async function assertOwnedFolder(userId: string, folderId: string): Promise<void> {
  const folder = await getDb().noteFolder.findFirst({ where: { id: folderId, userId } });
  if (!folder) {
    throw new AppError("Folder not found.", { code: "NOT_FOUND", status: 404 });
  }
}

/**
 * Normalizes editor content to plain JSON before it reaches Prisma. Values
 * that survive React's action deserialization but aren't honest JSON (exotic
 * prototypes, proxies) fail here with a friendly error instead of crashing
 * inside the database driver.
 */
function toPlainJson(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value)) as unknown;
  } catch {
    throw new AppError("Note content could not be saved.", { code: "VALIDATION", status: 400 });
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
