import { NextResponse } from "next/server";

import { listTasks } from "@/features/tasks/server/service";
import { getSessionUserId } from "@/lib/auth";

/** Read endpoint for TanStack Query refetches (initial data comes from RSC). */
export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tasks = await listTasks(userId);
  return NextResponse.json({ tasks });
}
