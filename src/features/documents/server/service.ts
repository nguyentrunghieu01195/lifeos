import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";

import { sanitizeFilename } from "../lib/files";
import type { CreateUploadInput } from "../schemas";
import type { DocumentDto, UploadTicket } from "../types";

/** Documents domain service — every read/write is scoped to the explicit userId. */

const STALE_PENDING_HOURS = 24;

const dtoSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  createdAt: true,
};

type DocumentRecord = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: Date;
};

function toDto(record: DocumentRecord): DocumentDto {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

export async function listDocuments(userId: string): Promise<DocumentDto[]> {
  const documents = await getDb().document.findMany({
    where: { userId, status: "READY" },
    select: dtoSelect,
    orderBy: { createdAt: "desc" },
  });
  return documents.map(toDto);
}

/**
 * Step 1 of the upload: record a PENDING row and hand the browser a URL to
 * PUT the bytes to. Nothing is visible in the library until finalizeUpload
 * verifies the object.
 */
export async function createUpload(
  userId: string,
  input: CreateUploadInput,
): Promise<UploadTicket> {
  const storage = getStorage();
  const key = `${userId}/${crypto.randomUUID()}/${sanitizeFilename(input.name)}`;

  const document = await getDb().document.create({
    data: {
      userId,
      name: input.name,
      key,
      mimeType: input.mimeType,
      size: input.size,
    },
    select: { id: true, key: true },
  });

  const uploadUrl = await storage.createUploadUrl({ key, documentId: document.id });
  return { documentId: document.id, uploadUrl };
}

/**
 * Step 2: verify the object really landed in storage with the declared size,
 * then flip the row to READY. A size mismatch destroys both the object and
 * the row — the client lied or the transfer was corrupted.
 */
export async function finalizeUpload(userId: string, id: string): Promise<DocumentDto> {
  const db = getDb();
  const document = await db.document.findFirst({
    where: { id, userId, status: "PENDING" },
    select: { ...dtoSelect, key: true },
  });
  if (!document) {
    throw new AppError("Upload not found.", { code: "NOT_FOUND", status: 404 });
  }

  const storage = getStorage();
  const actualSize = await storage.statSize(document.key);

  if (actualSize === null) {
    throw new AppError("The upload didn't complete — try again.", {
      code: "VALIDATION",
      status: 400,
    });
  }

  if (actualSize !== document.size) {
    await storage.remove(document.key).catch((error: unknown) => {
      console.warn(`[documents] failed to remove mismatched object ${document.key}:`, error);
    });
    await db.document.delete({ where: { id: document.id } });
    throw new AppError("The uploaded file didn't match its declared size.", {
      code: "VALIDATION",
      status: 400,
    });
  }

  const updated = await db.document.update({
    where: { id: document.id },
    data: { status: "READY" },
    select: dtoSelect,
  });
  return toDto(updated);
}

export async function renameDocument(
  userId: string,
  id: string,
  name: string,
): Promise<DocumentDto> {
  const result = await getDb().document.updateMany({
    where: { id, userId, status: "READY" },
    data: { name },
  });
  if (result.count === 0) {
    throw new AppError("Document not found.", { code: "NOT_FOUND", status: 404 });
  }
  const document = await getDb().document.findFirstOrThrow({
    where: { id },
    select: dtoSelect,
  });
  return toDto(document);
}

/** Deletes the row first (authorization boundary), then the bytes best-effort. */
export async function deleteDocument(userId: string, id: string): Promise<void> {
  const db = getDb();
  const document = await db.document.findFirst({
    where: { id, userId },
    select: { id: true, key: true },
  });
  if (!document) {
    throw new AppError("Document not found.", { code: "NOT_FOUND", status: 404 });
  }
  await db.document.delete({ where: { id: document.id } });
  await getStorage()
    .remove(document.key)
    .catch((error: unknown) => {
      console.warn(`[documents] failed to remove object ${document.key}:`, error);
    });
}

/** Descriptor for the authenticated file endpoint (READY files only). */
export async function getFileDescriptor(
  userId: string,
  id: string,
): Promise<{ key: string; name: string; mimeType: string; size: number } | null> {
  return getDb().document.findFirst({
    where: { id, userId, status: "READY" },
    select: { key: true, name: true, mimeType: true, size: true },
  });
}

/** Descriptor for the local upload endpoint (PENDING rows only). */
export async function getPendingUpload(
  userId: string,
  id: string,
): Promise<{ key: string; size: number } | null> {
  return getDb().document.findFirst({
    where: { id, userId, status: "PENDING" },
    select: { key: true, size: true },
  });
}

/**
 * Abandoned uploads (PENDING for over a day) are junk rows with possibly a
 * junk object behind them — sweep a bounded batch whenever the library loads.
 */
export async function purgeStalePending(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - STALE_PENDING_HOURS * 60 * 60 * 1000);
  const stale = await getDb().document.findMany({
    where: { userId, status: "PENDING", updatedAt: { lt: cutoff } },
    select: { id: true, key: true },
    take: 25,
  });
  if (stale.length === 0) return;

  const storage = getStorage();
  await Promise.all(
    stale.map((row) =>
      storage.remove(row.key).catch((error: unknown) => {
        console.warn(`[documents] failed to remove stale object ${row.key}:`, error);
      }),
    ),
  );
  await getDb().document.deleteMany({ where: { id: { in: stale.map((row) => row.id) } } });
}
