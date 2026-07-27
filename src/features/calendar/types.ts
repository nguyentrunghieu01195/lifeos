import type { TaskPriority, TaskStatus } from "@/features/tasks/types";

export type { ActionResult } from "@/types/actions";

export type EventSource = "LOCAL" | "GOOGLE";

export interface EventDto {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  source: EventSource;
  createdAt: string;
}

/** Slim task projection rendered on the calendar (read-only chips). */
export interface TaskCalendarItemDto {
  id: string;
  title: string;
  dueAt: string;
  status: TaskStatus;
  priority: TaskPriority;
}

export interface CalendarDataDto {
  events: EventDto[];
  tasks: TaskCalendarItemDto[];
}

export const EVENT_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#a855f7",
] as const;
