"use client";

import { format, isSameDay, parseISO } from "date-fns";
import { CalendarOff, MapPin } from "lucide-react";
import { useMemo } from "react";

import { EventChip, TaskChip } from "./event-chip";
import type { EventDto, TaskCalendarItemDto } from "../types";

interface AgendaListProps {
  events: EventDto[];
  tasks: TaskCalendarItemDto[];
  onEdit: (event: EventDto) => void;
}

/** Chronological agenda over the fetched range, grouped by day. */
export function AgendaList({ events, tasks, onEdit }: AgendaListProps) {
  const days = useMemo(() => {
    const map = new Map<string, { day: Date; events: EventDto[]; tasks: TaskCalendarItemDto[] }>();
    const ensure = (date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      const existing = map.get(key);
      if (existing) return existing;
      const entry: { day: Date; events: EventDto[]; tasks: TaskCalendarItemDto[] } = {
        day: date,
        events: [],
        tasks: [],
      };
      map.set(key, entry);
      return entry;
    };
    for (const event of events) {
      ensure(parseISO(event.startAt)).events.push(event);
    }
    for (const task of tasks) {
      ensure(parseISO(task.dueAt)).tasks.push(task);
    }
    return [...map.values()].sort((a, b) => a.day.getTime() - b.day.getTime());
  }, [events, tasks]);

  if (days.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <CalendarOff aria-hidden className="size-6" />
        Nothing scheduled in this range yet.
      </div>
    );
  }

  const today = new Date();

  return (
    <div className="space-y-5">
      {days.map(({ day, events: dayEvents, tasks: dayTasks }) => (
        <section key={day.toISOString()} aria-label={format(day, "MMMM d")}>
          <h3 className="mb-1.5 flex items-baseline gap-2 px-1">
            <span className="text-lg font-semibold tabular-nums">{format(day, "d")}</span>
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {format(day, "EEEE, MMMM yyyy")}
              {isSameDay(day, today) ? " · Today" : ""}
            </span>
          </h3>
          <div className="space-y-1">
            {dayEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <EventChip event={event} onClick={() => onEdit(event)} />
                </div>
                {event.location ? (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin aria-hidden className="size-3" />
                    {event.location}
                  </span>
                ) : null}
              </div>
            ))}
            {dayTasks.map((task) => (
              <TaskChip key={task.id} task={task} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
