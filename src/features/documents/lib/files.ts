/** Pure file helpers shared by client and server. */

export const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB per file

/**
 * Upload allowlist. application/octet-stream admits generic binaries (always
 * served as a download); everything else maps to a concrete preview behavior.
 */
export const ACCEPTED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/octet-stream",
] as const;

export type AcceptedMimeType = (typeof ACCEPTED_MIME_TYPES)[number];

/**
 * Types the file endpoint may serve inline (previews, images inside notes).
 * SVG is deliberately absent: inline SVG executes scripts on our origin, so
 * it downloads as an attachment like any other binary.
 */
export const INLINE_SAFE_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export type DocumentKind = "image" | "pdf" | "text" | "sheet" | "archive" | "other";

export function kindOf(mimeType: string): DocumentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType === "application/pdf") return "pdf";
  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "text";
  }
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "sheet";
  }
  if (mimeType === "application/zip") return "archive";
  return "other";
}

/**
 * Make a filename safe for storage keys and Content-Disposition fallbacks:
 * strips any path, keeps the extension, and reduces the rest to
 * [a-zA-Z0-9._-]. Never returns an empty string.
 */
export function sanitizeFilename(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // drop diacritics after decomposition
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "");
  const capped = cleaned.slice(-120);
  return capped || "file";
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
