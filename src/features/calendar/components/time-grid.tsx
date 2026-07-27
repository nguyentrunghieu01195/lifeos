"use client";

import { eachDayOfInterval, format, isSameDay, parseISO } from "date-fns";
import { useMemo } from "react";

import { cn } from "@/lib/utils";

import { eventBlockPosition } from "../lib/time";
import type { EventDto, TaskCalendarItemDto } from "../types";
import { TaskChip } from "./event-chip";

const HOUR_HEIGHT_PX = 48;
const TRACK_HEIGHT_PX = 24 * HOUR_HEIGHT_PX;

interface TimeGridProps {
  from: Date;
  to: Date;
  events: EventDto[];
  tasks: TaskCalendarItemDto[];
  onEdit: (event: EventDto) => void;
  onCreateAt: (start: Date) => void;
}

/** Hour-grid used by both the week view (7 columns) and the day view (1). */
export function TimeGrid({ from, to, events, tasks, onEdit, onCreateAt }: TimeGridProps) {
  const days = useMemo(() => eachDayOfInterval({ start: from, end: to }), [from, to]);
  const today = new Date();

  const allDayFor = (day: Date) =>
    events.filter((event) => event.allDay && isSameDay(parseISO(event.startAt), day));
  const timedFor = (day: Date) =>
    events.filter((event) => !event.allDay && isSameDay(parseISO(event.startAt), day));
  const tasksFor = (day: Date) => tasks.filter((task) => isSameDay(parseISO(task.dueAt), day));

  const handleColumnClick = (day: Date, clickEvent: React.MouseEvent<HTMLDivElement>) => {
    const rect = clickEvent.currentTarget.getBoundingClientRect();
    const minutes = ((clickEvent.clientY - rect.top) / rect.height) * 24 * 60;
    const rounded = Math.max(0, Math.min(23.5 * 60, Math.round(minutes / 30) * 30));
    const start = new Date(day);
    start.setHours(Math.floor(rounded / 60), rounded % 60, 0, 0);
    onCreateAt(start);
  };

  return (
    <div className="overflow-hidden rounded-xl border">
      {/* Header: day names + all-day events + task chips */}
      <div
        className="grid border-b"
        style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <div className="bg-muted/40" />
        {days.map((day) => (
          <div key={day.toISOString()} className="border-l bg-muted/40 p-1.5">
            <p
              className={cn(
                "text-center text-xs font-medium",
                isSameDay(day, today) ? "text-primary" : "text-muted-foreground",
              )}
            >
              {format(day, days.length === 1 ? "EEEE, MMM d" : "EEE d")}
            </p>
            <div className="mt-1 space-y-1">
              {allDayFor(day).map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEdit(event)}
                  className="w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] text-white"
                  style={{ backgroundColor: event.color }}
                >
                  {event.title}
                </button>
              ))}
              {tasksFor(day).map((task) => (
                <TaskChip key={task.id} task={task} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Scrollable 24h track */}
      <div className="max-h-[65vh] overflow-y-auto">
        <div
          className="grid"
          style={{ gridTemplateColumns: `3.5rem repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {/* Hour labels */}
          <div className="relative" style={{ height: TRACK_HEIGHT_PX }}>
            {Array.from({ length: 24 }).map((_, hour) => (
              <span
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted-foreground tabular-nums"
                style={{ top: hour * HOUR_HEIGHT_PX }}
              >
                {hour === 0 ? "" : `${String(hour).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="relative cursor-pointer border-l"
              style={{ height: TRACK_HEIGHT_PX }}
              onClick={(clickEvent) => handleColumnClick(day, clickEvent)}
              role="button"
              aria-label={`Create event on ${format(day, "MMMM d")}`}
              tabIndex={-1}
            >
              {/* Hour lines */}
              {Array.from({ length: 24 }).map((_, hour) => (
                <div
                  key={hour}
                  aria-hidden
                  className="absolute right-0 left-0 border-t border-border/60"
                  style={{ top: hour * HOUR_HEIGHT_PX }}
                />
              ))}

              {timedFor(day).map((event) => {
                const { topPct, heightPct } = eventBlockPosition(
                  parseISO(event.startAt),
                  parseISO(event.endAt),
                  day,
                );
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      onEdit(event);
                    }}
                    className="absolute right-1 left-1 overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] text-white shadow-xs"
                    style={{
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      backgroundColor: event.color,
                    }}
                  >
                    <span className="block truncate font-medium">{event.title}</span>
                    <span className="block truncate opacity-90">
                      {format(parseISO(event.startAt), "HH:mm")}–
                      {format(parseISO(event.endAt), "HH:mm")}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
