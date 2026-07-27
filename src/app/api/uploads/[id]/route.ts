import { NextResponse, type NextRequest } from "next/server";

import { MAX_FILE_SIZE } from "@/features/documents/lib/files";
import { getPendingUpload } from "@/features/documents/server/service";
import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";
import { getStorage } from "@/lib/storage";
import { writeLocalObject } from "@/lib/storage/local";

/**
 * Upload target for the LOCAL storage driver only — the browser PUTs file
 * bytes here when there is no R2 to presign (development/CI). On R2 the
 * browser talks to the presigned URL directly and this route answers 404.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let storage;
  try {
    storage = getStorage();
  } catch (error) {
    const message = isAppError(error) ? error.message : "File storage is not configured.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
  if (storage.kind !== "local") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const upload = await getPendingUpload(userId, id);
  if (!upload) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large" }, { status: 413 });
  }
  if (body.byteLength !== upload.size) {
    return NextResponse.json({ error: "Size mismatch" }, { status: 400 });
  }

  await writeLocalObject(upload.key, new Uint8Array(body));
  return NextResponse.json({ ok: true });
}
