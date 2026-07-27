/**
 * Client-safe DTOs for the tasks feature. Everything that crosses the
 * server/client boundary is serialized here (dates as ISO strings), so RSC
 * initial data and route-handler responses have identical shapes.
 */

export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE";
export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
export type TaskSource = "MANUAL" | "AI";

export interface ProjectDto {
  id: string;
  name: string;
  color: string;
}

export interface TagDto {
  id: string;
  name: string;
  color: string;
}

export interface SubtaskDto {
  id: string;
  title: string;
  status: TaskStatus;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  position: number;
  dueAt: string | null;
  reminderAt: string | null;
  completedAt: string | null;
  recurrenceFreq: RecurrenceFreq | null;
  recurrenceInterval: number | null;
  projectId: string | null;
  parentId: string | null;
  project: ProjectDto | null;
  tags: TagDto[];
  subtasks: SubtaskDto[];
  createdAt: string;
}

export const TASK_STATUSES: TaskStatus[] = ["TODO", "IN_PROGRESS", "DONE"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const RECURRENCE_LABELS: Record<RecurrenceFreq, string> = {
  DAILY: "day",
  WEEKLY: "week",
  MONTHLY: "month",
  YEARLY: "year",
};

export type { ActionResult } from "@/types/actions";
