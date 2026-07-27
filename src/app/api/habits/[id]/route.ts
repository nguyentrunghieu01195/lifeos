import { NextResponse, type NextRequest } from "next/server";

import { getHabitDetail } from "@/features/habits/server/service";
import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);

  try {
    const detail = await getHabitDetail(userId, id, today);
    return NextResponse.json(detail);
  } catch (error) {
    const status = isAppError(error) ? error.status : 500;
    const message = isAppError(error) ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
