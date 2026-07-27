import { format, parseISO } from "date-fns";
import { ArrowRight, CalendarDays } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EventDto } from "@/features/calendar/types";

/** Dashboard widget: the next few events, straight from the database. */
export function UpcomingEventsCard({ events }: { events: EventDto[] }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Upcoming events</CardTitle>
        <CardDescription>
          {events.length === 0 ? "Nothing on the calendar yet." : "What's next on your calendar."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {events.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarDays aria-hidden className="size-4" />
            Your schedule is clear.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: event.color }}
                />
                <span className="truncate">{event.title}</span>
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {event.allDay
                    ? format(parseISO(event.startAt), "MMM d")
                    : format(parseISO(event.startAt), "MMM d, HH:mm")}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/calendar">
            Open calendar
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
