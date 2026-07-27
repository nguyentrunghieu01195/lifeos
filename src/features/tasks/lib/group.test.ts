import { describe, expect, it } from "vitest";

import { groupTasks, isOverdue } from "@/features/tasks/lib/group";
import type { TaskDto } from "@/features/tasks/types";

const now = new Date("2026-07-27T12:00:00");

function task(overrides: Partial<TaskDto>): TaskDto {
  return {
    id: Math.random().toString(36).slice(2),
    title: "Task",
    description: null,
    status: "TODO",
    priority: "MEDIUM",
    source: "MANUAL",
    position: 0,
    dueAt: null,
    reminderAt: null,
    completedAt: null,
    recurrenceFreq: null,
    recurrenceInterval: null,
    projectId: null,
    parentId: null,
    project: null,
    tags: [],
    subtasks: [],
    createdAt: now.toISOString(),
    ...overrides,
  };
}

describe("groupTasks", () => {
  it("buckets open tasks by due date and collects done separately", () => {
    const groups = groupTasks(
      [
        task({ id: "overdue", dueAt: "2026-07-25T09:00:00.000Z" }),
        task({ id: "today", dueAt: new Date("2026-07-27T18:00:00").toISOString() }),
        task({ id: "upcoming", dueAt: "2026-08-02T09:00:00.000Z" }),
        task({ id: "someday" }),
        task({ id: "done", status: "DONE", dueAt: "2026-07-25T09:00:00.000Z" }),
      ],
      now,
    );

    expect(groups.overdue.map((t) => t.id)).toEqual(["overdue"]);
    expect(groups.today.map((t) => t.id)).toEqual(["today"]);
    expect(groups.upcoming.map((t) => t.id)).toEqual(["upcoming"]);
    expect(groups.someday.map((t) => t.id)).toEqual(["someday"]);
    expect(groups.done.map((t) => t.id)).toEqual(["done"]);
  });
});

describe("isOverdue", () => {
  it("is true only for open tasks due before today", () => {
    expect(isOverdue(task({ dueAt: "2026-07-25T09:00:00.000Z" }), now)).toBe(true);
    expect(isOverdue(task({ dueAt: new Date("2026-07-27T08:00:00").toISOString() }), now)).toBe(
      false,
    );
    expect(isOverdue(task({ status: "DONE", dueAt: "2026-07-25T09:00:00.000Z" }), now)).toBe(false);
    expect(isOverdue(task({}), now)).toBe(false);
  });
});
