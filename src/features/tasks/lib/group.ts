import { isBefore, isSameDay, parseISO, startOfDay } from "date-fns";

import type { TaskDto } from "../types";

export interface GroupedTasks {
  overdue: TaskDto[];
  today: TaskDto[];
  upcoming: TaskDto[];
  someday: TaskDto[];
  done: TaskDto[];
}

/** List-view grouping. Open tasks bucket by due date; DONE collects separately. */
export function groupTasks(tasks: TaskDto[], now: Date = new Date()): GroupedTasks {
  const groups: GroupedTasks = { overdue: [], today: [], upcoming: [], someday: [], done: [] };
  const todayStart = startOfDay(now);

  for (const task of tasks) {
    if (task.status === "DONE") {
      groups.done.push(task);
      continue;
    }
    if (!task.dueAt) {
      groups.someday.push(task);
      continue;
    }
    const due = parseISO(task.dueAt);
    if (isSameDay(due, now)) {
      groups.today.push(task);
    } else if (isBefore(due, todayStart)) {
      groups.overdue.push(task);
    } else {
      groups.upcoming.push(task);
    }
  }
  return groups;
}

/** True when an open task's due date is strictly before the start of today. */
export function isOverdue(task: TaskDto, now: Date = new Date()): boolean {
  if (task.status === "DONE" || !task.dueAt) return false;
  const due = parseISO(task.dueAt);
  return isBefore(due, startOfDay(now)) && !isSameDay(due, now);
}
