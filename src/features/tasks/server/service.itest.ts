import { addDays } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createProject,
  createSubtask,
  createTag,
  createTask,
  deleteTask,
  getTodayTaskSummary,
  listTasks,
  moveTask,
  toggleTask,
  updateTask,
} from "@/features/tasks/server/service";
import { getDb } from "@/lib/db";

/**
 * Integration tests for the tasks service against a real Postgres. The
 * ownership tests are the security contract: user B must never be able to
 * read or mutate user A's data.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

describe.runIf(hasDatabase)("tasks service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-tasks-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-tasks-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates tasks with sane defaults and increasing positions", async () => {
    const first = await createTask(userA, { title: "First task" });
    const second = await createTask(userA, { title: "Second task" });

    expect(first.status).toBe("TODO");
    expect(first.priority).toBe("MEDIUM");
    expect(second.position).toBeGreaterThan(first.position);

    const tasks = await listTasks(userA);
    expect(tasks.map((task) => task.id)).toContain(first.id);
  });

  it("completes and reopens a plain task", async () => {
    const task = await createTask(userA, { title: "Toggle me" });

    const done = await toggleTask(userA, task.id);
    expect(done.status).toBe("DONE");
    expect(done.completedAt).not.toBeNull();

    const reopened = await toggleTask(userA, task.id);
    expect(reopened.status).toBe("TODO");
    expect(reopened.completedAt).toBeNull();
  });

  it("rolls recurring tasks forward instead of completing them", async () => {
    const due = new Date();
    const task = await createTask(userA, {
      title: "Water the plants",
      dueAt: due.toISOString(),
      recurrenceFreq: "WEEKLY",
      recurrenceInterval: 1,
    });

    const rolled = await toggleTask(userA, task.id);
    expect(rolled.status).toBe("TODO");
    expect(rolled.completedAt).toBeNull();
    expect(new Date(rolled.dueAt ?? 0).getTime()).toBeGreaterThan(due.getTime());
  });

  it("moves tasks across board columns and sets completedAt on DONE", async () => {
    const task = await createTask(userA, { title: "Board task" });

    const moved = await moveTask(userA, { id: task.id, status: "DONE", position: 500 });
    expect(moved.status).toBe("DONE");
    expect(moved.position).toBe(500);
    expect(moved.completedAt).not.toBeNull();

    const back = await moveTask(userA, { id: task.id, status: "IN_PROGRESS", position: 750 });
    expect(back.completedAt).toBeNull();
  });

  it("supports subtasks and keeps them attached to the parent", async () => {
    const parent = await createTask(userA, { title: "Parent" });
    await createSubtask(userA, parent.id, "Child step");

    const tasks = await listTasks(userA);
    const withSubtasks = tasks.find((task) => task.id === parent.id);
    expect(withSubtasks?.subtasks.map((subtask) => subtask.title)).toContain("Child step");
    // Subtasks never appear as top-level rows.
    expect(tasks.some((task) => task.title === "Child step")).toBe(false);
  });

  it("connects only tags owned by the same user", async () => {
    const ownTag = await createTag(userA, `own-${crypto.randomUUID().slice(0, 8)}`);
    const foreignTag = await createTag(userB, `foreign-${crypto.randomUUID().slice(0, 8)}`);

    const task = await createTask(userA, {
      title: "Tagged",
      tagIds: [ownTag.id, foreignTag.id],
    });
    expect(task.tags.map((tag) => tag.id)).toEqual([ownTag.id]);
  });

  it("rejects duplicate project names per user with a clear error", async () => {
    const name = `Home-${crypto.randomUUID().slice(0, 8)}`;
    await createProject(userA, name);
    await expect(createProject(userA, name)).rejects.toThrow("already exists");
    // Same name is fine for a different user.
    await expect(createProject(userB, name)).resolves.toMatchObject({ name });
  });

  it("enforces ownership: user B cannot read or mutate user A's tasks", async () => {
    const task = await createTask(userA, { title: "Private to A" });

    await expect(toggleTask(userB, task.id)).rejects.toThrow("Task not found");
    await expect(updateTask(userB, { id: task.id, title: "hijacked" })).rejects.toThrow(
      "Task not found",
    );
    await expect(deleteTask(userB, task.id)).rejects.toThrow("Task not found");

    const tasksForB = await listTasks(userB);
    expect(tasksForB.some((candidate) => candidate.id === task.id)).toBe(false);

    // Untouched for its owner.
    const tasksForA = await listTasks(userA);
    expect(tasksForA.find((candidate) => candidate.id === task.id)?.title).toBe("Private to A");
  });

  it("summarizes today's and overdue tasks for the dashboard", async () => {
    const yesterday = addDays(new Date(), -1).toISOString();
    await createTask(userA, { title: "Slipped", dueAt: yesterday });

    const summary = await getTodayTaskSummary(userA);
    expect(summary.openCount).toBeGreaterThan(0);
    expect(summary.dueTodayOrOverdue.some((task) => task.title === "Slipped")).toBe(true);
  });
});
