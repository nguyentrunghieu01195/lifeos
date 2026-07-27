import { NextResponse, type NextRequest } from "next/server";

import { INLINE_SAFE_TYPES } from "@/features/documents/lib/files";
import { getFileDescriptor } from "@/features/documents/server/service";
import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { readLocalObject } from "@/lib/storage/local";
import { contentDisposition } from "@/lib/storage/r2";

/**
 * Stable, authenticated URL for a stored file: /api/files/[id].
 *
 * This is what notes embed and what previews/downloads use — it never
 * expires. On R2 it redirects to a short-lived presigned GET; on the local
 * driver it streams from disk. Only inline-safe types (raster images, PDF)
 * render in the browser; everything else — including SVG, which could run
 * scripts on our origin — is forced to download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const file = await getFileDescriptor(userId, id);
  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const download = request.nextUrl.searchParams.get("download") === "1";
  const inline = !download && INLINE_SAFE_TYPES.has(file.mimeType);
  const contentType = inline ? file.mimeType : "application/octet-stream";

  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    const message = isAppError(error) ? error.message : "File storage is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  if (storage.kind === "r2") {
    const url = await storage.createDownloadUrl({
      key: file.key,
      filename: file.name,
      contentType,
      inline,
    });
    if (!url) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.redirect(url, {
      status: 302,
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const bytes = await readLocalObject(file.key);
  if (!bytes) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": contentDisposition(file.name, inline),
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
}
