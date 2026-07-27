import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarViewRoot } from "@/features/calendar/components/calendar-view";
import { computeRange } from "@/features/calendar/lib/range";
import { getCalendarData } from "@/features/calendar/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  // Seed the default view (current month); other ranges load client-side.
  const range = computeRange("month", new Date());
  const initialData = await getCalendarData(userId, range.from, range.to);

  return (
    <CalendarViewRoot
      initialData={initialData}
      initialFrom={range.from.toISOString()}
      initialTo={range.to.toISOString()}
    />
  );
}
