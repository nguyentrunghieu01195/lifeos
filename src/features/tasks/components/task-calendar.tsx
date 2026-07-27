"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { TaskDto } from "../types";
import { PRIORITY_DOT } from "./task-item";

interface TaskCalendarProps {
  tasks: TaskDto[];
  onEdit: (task: TaskDto) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month view of tasks by due date. */
export function TaskCalendar({ tasks, onEdit }: TaskCalendarProps) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const today = new Date();

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      }),
    [cursor],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskDto[]>();
    for (const task of tasks) {
      if (!task.dueAt) continue;
      const key = format(parseISO(task.dueAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight">{format(cursor, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => setCursor((value) => addMonths(value, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(startOfMonth(new Date()))}>
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => setCursor((value) => addMonths(value, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-b bg-muted/40 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayTasks = tasksByDay.get(key) ?? [];
          const isToday = isSameDay(day, today);
          const inMonth = isSameMonth(day, cursor);

          return (
            <div
              key={key}
              className={cn(
                "min-h-24 border-t border-r p-1.5 [&:nth-child(7n+8)]:border-l-0",
                !inMonth && "bg-muted/20",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs",
                  !inMonth && "text-muted-foreground/60",
                  isToday && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-1">
                {dayTasks.slice(0, 3).map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onEdit(task)}
                    className={cn(
                      "flex w-full items-center gap-1.5 truncate rounded border bg-card px-1.5 py-0.5 text-left text-[11px] transition-colors hover:bg-accent",
                      task.status === "DONE" && "text-muted-foreground line-through opacity-70",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
                    />
                    <span className="truncate">{task.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 ? (
                  <p className="px-1 text-[10px] text-muted-foreground">
                    +{dayTasks.length - 3} more
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
