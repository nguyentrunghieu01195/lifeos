"use client";

import { format, parseISO } from "date-fns";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

import type { EventDto, TaskCalendarItemDto } from "../types";

/** Compact event chip used by the month grid and agenda. */
export function EventChip({
  event,
  onClick,
  showTime = true,
}: {
  event: EventDto;
  onClick?: () => void;
  showTime?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-1.5 truncate rounded border bg-card px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-accent"
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: event.color }}
      />
      {showTime && !event.allDay ? (
        <span className="shrink-0 text-muted-foreground tabular-nums">
          {format(parseISO(event.startAt), "HH:mm")}
        </span>
      ) : null}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

/** Read-only task chip on the calendar — clicking jumps to the Tasks module. */
export function TaskChip({ task }: { task: TaskCalendarItemDto }) {
  return (
    <Link
      href="/tasks"
      className={cn(
        "flex w-full items-center gap-1.5 truncate rounded border border-dashed border-primary/30 bg-primary/5 px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-primary/10",
        task.status === "DONE" && "line-through opacity-60",
      )}
      title={`Task: ${task.title}`}
    >
      <CheckCircle2 aria-hidden className="size-3 shrink-0 text-primary" />
      <span className="truncate">{task.title}</span>
    </Link>
  );
}
