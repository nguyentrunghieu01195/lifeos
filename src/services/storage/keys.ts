/**
 * Object key strategy for Cloudflare R2.
 *
 * Every object lives under the owning user's namespace so authorization can be
 * enforced by prefix and account deletion can purge a single prefix:
 *
 *   users/<userId>/<category>/<uuid>-<sanitized-filename>
 */

export const STORAGE_CATEGORIES = ["documents", "images", "avatars", "attachments"] as const;
export type StorageCategory = (typeof STORAGE_CATEGORIES)[number];

const MAX_FILENAME_LENGTH = 100;

/**
 * Make an arbitrary user-supplied filename safe for use inside an object key:
 * strips directory components, control characters and key-hostile characters,
 * collapses whitespace, and caps length while preserving the extension.
 */
export function sanitizeFilename(filename: string): string {
  const basename = filename.split(/[/\\]/).pop() ?? "";
  const cleaned = basename
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/[^\p{L}\p{N}._ -]/gu, "-")
    .replace(/\s+/g, " ")
    .replace(/-{2,}/g, "-")
    .trim()
    .replace(/^[.-]+/, "");

  if (cleaned.length === 0) return "file";
  if (cleaned.length <= MAX_FILENAME_LENGTH) return cleaned;

  const dotIndex = cleaned.lastIndexOf(".");
  if (dotIndex > 0 && cleaned.length - dotIndex <= 12) {
    const extension = cleaned.slice(dotIndex);
    return cleaned.slice(0, MAX_FILENAME_LENGTH - extension.length) + extension;
  }
  return cleaned.slice(0, MAX_FILENAME_LENGTH);
}

export interface BuildObjectKeyInput {
  userId: string;
  category: StorageCategory;
  filename: string;
}

export function buildObjectKey({ userId, category, filename }: BuildObjectKeyInput): string {
  return `users/${userId}/${category}/${crypto.randomUUID()}-${sanitizeFilename(filename)}`;
}

/** Extract the owning user id from an object key, or null for foreign keys. */
export function userIdFromObjectKey(key: string): string | null {
  const match = /^users\/([^/]+)\//.exec(key);
  return match?.[1] ?? null;
}
