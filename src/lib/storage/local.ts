import "server-only";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "@/lib/errors";

import type { StorageDriver } from "./index";

/**
 * Local filesystem driver — development and CI only (getStorage never selects
 * it on strict production). Files live under .storage/ (gitignored); uploads
 * go through PUT /api/uploads/[id] since there is nothing to presign.
 */

const ROOT = path.join(process.cwd(), ".storage");

/** Resolve a storage key inside ROOT, rejecting traversal attempts. */
function resolveSafe(key: string): string {
  const resolved = path.resolve(ROOT, key);
  if (!resolved.startsWith(ROOT + path.sep)) {
    throw new AppError("Invalid storage key.", { code: "VALIDATION", status: 400 });
  }
  return resolved;
}

export async function writeLocalObject(key: string, bytes: Uint8Array): Promise<void> {
  const target = resolveSafe(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, bytes);
}

export async function readLocalObject(key: string): Promise<Uint8Array | null> {
  try {
    return await readFile(resolveSafe(key));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function createLocalDriver(): StorageDriver {
  return {
    kind: "local",

    async createUploadUrl({ documentId }) {
      return `/api/uploads/${documentId}`;
    },

    async statSize(key) {
      try {
        const info = await stat(resolveSafe(key));
        return info.isFile() ? info.size : null;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async createDownloadUrl() {
      return null; // the file route streams from disk instead
    },

    async remove(key) {
      await rm(resolveSafe(key), { force: true });
    },
  };
}
