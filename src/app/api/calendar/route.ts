import { NextResponse, type NextRequest } from "next/server";

import { calendarRangeSchema } from "@/features/calendar/schemas";
import { getCalendarData } from "@/features/calendar/server/service";
import { getSessionUserId } from "@/lib/auth";

/** Range read endpoint for TanStack Query (initial data comes from RSC). */
export async function GET(request: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = calendarRangeSchema.safeParse({
    from: request.nextUrl.searchParams.get("from"),
    to: request.nextUrl.searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  }

  const data = await getCalendarData(userId, new Date(parsed.data.from), new Date(parsed.data.to));
  return NextResponse.json(data);
}
