import { NextResponse } from "next/server";

import { getHealthSnapshot } from "@/features/health/server/service";
import { getSessionUserId } from "@/lib/auth";

export async function GET(): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const snapshot = await getHealthSnapshot(userId);
  return NextResponse.json(snapshot);
}
