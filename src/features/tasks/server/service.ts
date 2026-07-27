import "server-only";

import { addDays } from "date-fns";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import { nextOccurrence } from "../lib/recurrence";
import type { CreateTaskInput, MoveTaskInput, UpdateTaskInput } from "../schemas";
import type { ProjectDto, TagDto, TaskDto, TaskStatus } from "../types";

/**
 * Tasks domain service. Every function takes an explicit userId and scopes
 * every read and write to it — ownership is enforced here, not in the UI.
 * Actions wrap these with session + input validation; integration tests hit
 * them directly against a real Postgres.
 */

const POSITION_GAP = 1000;

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
  tags: { select: { id: true, name: true, color: true } },
  subtasks: {
    select: { id: true, title: true, status: true },
    orderBy: { createdAt: "asc" as const },
  },
};

type TaskRecord = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getDb>["task"]["findFirst"]>>
> & {
  project: ProjectDto | null;
  tags: TagDto[];
  subtasks: Array<{ id: string; title: string; status: TaskStatus }>;
};

function toTaskDto(task: TaskRecord): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    source: task.source,
    position: task.position,
    dueAt: task.dueAt?.toISOString() ?? null,
    reminderAt: task.reminderAt?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    recurrenceFreq: task.recurrenceFreq,
    recurrenceInterval: task.recurrenceInterval,
    projectId: task.projectId,
    parentId: task.parentId,
    project: task.project,
    tags: task.tags,
    subtasks: task.subtasks,
    createdAt: task.createdAt.toISOString(),
  };
}

async function findOwnedTask(userId: string, id: string) {
  const task = await getDb().task.findFirst({ where: { id, userId }, include: taskInclude });
  if (!task) {
    throw new AppError("Task not found.", { code: "NOT_FOUND", status: 404 });
  }
  return task as TaskRecord;
}

/** Keep only tag ids that belong to the user (silently drops foreign ids). */
async function ownedTagIds(userId: string, tagIds: string[] | undefined): Promise<string[]> {
  if (!tagIds || tagIds.length === 0) return [];
  const tags = await getDb().tag.findMany({
    where: { userId, id: { in: tagIds } },
    select: { id: true },
  });
  return tags.map((tag) => tag.id);
}

async function assertOwnedProject(userId: string, projectId: string): Promise<void> {
  const project = await getDb().project.findFirst({ where: { id: projectId, userId } });
  if (!project) {
    throw new AppError("Project not found.", { code: "NOT_FOUND", status: 404 });
  }
}

async function nextPosition(userId: string, status: TaskStatus): Promise<number> {
  const max = await getDb().task.aggregate({
    where: { userId, status, parentId: null },
    _max: { position: true },
  });
  return (max._max.position ?? 0) + POSITION_GAP;
}

// --- Reads -------------------------------------------------------------------

export async function listTasks(userId: string): Promise<TaskDto[]> {
  const tasks = await getDb().task.findMany({
    where: { userId, parentId: null },
    include: taskInclude,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });
  return (tasks as TaskRecord[]).map(toTaskDto);
}

export async function listProjects(userId: string): Promise<ProjectDto[]> {
  return getDb().project.findMany({
    where: { userId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

export async function listTags(userId: string): Promise<TagDto[]> {
  return getDb().tag.findMany({
    where: { userId },
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
}

export interface TodayTaskSummary {
  openCount: number;
  dueTodayOrOverdue: TaskDto[];
}

/** Dashboard widget data: open-task count plus the next due/overdue five. */
export async function getTodayTaskSummary(
  userId: string,
  now: Date = new Date(),
): Promise<TodayTaskSummary> {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  const [openCount, due] = await Promise.all([
    getDb().task.count({ where: { userId, parentId: null, status: { not: "DONE" } } }),
    getDb().task.findMany({
      where: {
        userId,
        parentId: null,
        status: { not: "DONE" },
        dueAt: { lte: endOfToday },
      },
      include: taskInclude,
      orderBy: { dueAt: "asc" },
      take: 5,
    }),
  ]);

  return { openCount, dueTodayOrOverdue: (due as TaskRecord[]).map(toTaskDto) };
}

// --- Writes ------------------------------------------------------------------

export async function createTask(userId: string, input: CreateTaskInput): Promise<TaskDto> {
  if (input.projectId) {
    await assertOwnedProject(userId, input.projectId);
  }
  if (input.parentId) {
    await findOwnedTask(userId, input.parentId);
  }
  const tagIds = await ownedTagIds(userId, input.tagIds);
  const status = input.status ?? "TODO";

  const task = await getDb().task.create({
    data: {
      userId,
      title: input.title,
      description: input.description || null,
      projectId: input.projectId ?? null,
      parentId: input.parentId ?? null,
      priority: input.priority ?? "MEDIUM",
      status,
      position: await nextPosition(userId, status),
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      reminderAt: input.reminderAt ? new Date(input.reminderAt) : null,
      recurrenceFreq: input.recurrenceFreq ?? null,
      recurrenceInterval: input.recurrenceFreq ? (input.recurrenceInterval ?? 1) : null,
      tags: { connect: tagIds.map((id) => ({ id })) },
    },
    include: taskInclude,
  });
  return toTaskDto(task as TaskRecord);
}

export async function updateTask(userId: string, input: UpdateTaskInput): Promise<TaskDto> {
  await findOwnedTask(userId, input.id);
  if (input.projectId) {
    await assertOwnedProject(userId, input.projectId);
  }

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.projectId !== undefined) data.projectId = input.projectId;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.status !== undefined) data.status = input.status;
  if (input.dueAt !== undefined) data.dueAt = input.dueAt ? new Date(input.dueAt) : null;
  if (input.reminderAt !== undefined) {
    data.reminderAt = input.reminderAt ? new Date(input.reminderAt) : null;
  }
  if (input.recurrenceFreq !== undefined) {
    data.recurrenceFreq = input.recurrenceFreq;
    data.recurrenceInterval = input.recurrenceFreq ? (input.recurrenceInterval ?? 1) : null;
  } else if (input.recurrenceInterval !== undefined) {
    data.recurrenceInterval = input.recurrenceInterval;
  }
  if (input.tagIds !== undefined) {
    const tagIds = await ownedTagIds(userId, input.tagIds);
    data.tags = { set: tagIds.map((id) => ({ id })) };
  }

  const task = await getDb().task.update({
    where: { id: input.id },
    data,
    include: taskInclude,
  });
  return toTaskDto(task as TaskRecord);
}

/**
 * Complete/reopen a task. Completing a recurring task rolls its due date to
 * the next occurrence and keeps it open (Todoist behavior).
 */
export async function toggleTask(userId: string, id: string): Promise<TaskDto> {
  const task = await findOwnedTask(userId, id);

  if (task.status !== "DONE" && task.recurrenceFreq && task.dueAt) {
    const rolled = await getDb().task.update({
      where: { id },
      data: {
        dueAt: nextOccurrence(task.dueAt, task.recurrenceFreq, task.recurrenceInterval ?? 1),
        status: "TODO",
        completedAt: null,
      },
      include: taskInclude,
    });
    return toTaskDto(rolled as TaskRecord);
  }

  const done = task.status !== "DONE";
  const updated = await getDb().task.update({
    where: { id },
    data: { status: done ? "DONE" : "TODO", completedAt: done ? new Date() : null },
    include: taskInclude,
  });
  return toTaskDto(updated as TaskRecord);
}

/** Board drag-and-drop: change column and/or position. */
export async function moveTask(userId: string, input: MoveTaskInput): Promise<TaskDto> {
  const task = await findOwnedTask(userId, input.id);

  // Dropping into DONE completes; recurring tasks roll forward instead.
  if (input.status === "DONE" && task.status !== "DONE" && task.recurrenceFreq && task.dueAt) {
    return toggleTask(userId, input.id);
  }

  const updated = await getDb().task.update({
    where: { id: input.id },
    data: {
      status: input.status,
      position: input.position,
      completedAt: input.status === "DONE" ? (task.completedAt ?? new Date()) : null,
    },
    include: taskInclude,
  });
  return toTaskDto(updated as TaskRecord);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const result = await getDb().task.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new AppError("Task not found.", { code: "NOT_FOUND", status: 404 });
  }
}

export async function createSubtask(
  userId: string,
  parentId: string,
  title: string,
): Promise<TaskDto> {
  const parent = await findOwnedTask(userId, parentId);
  return createTask(userId, { title, parentId: parent.id });
}

export async function createProject(
  userId: string,
  name: string,
  color?: string,
): Promise<ProjectDto> {
  try {
    const project = await getDb().project.create({
      data: { userId, name, ...(color ? { color } : {}) },
      select: { id: true, name: true, color: true },
    });
    return project;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("A project with this name already exists.", {
        code: "VALIDATION",
        status: 409,
      });
    }
    throw error;
  }
}

export async function createTag(userId: string, name: string, color?: string): Promise<TagDto> {
  try {
    const tag = await getDb().tag.create({
      data: { userId, name, ...(color ? { color } : {}) },
      select: { id: true, name: true, color: true },
    });
    return tag;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError("A tag with this name already exists.", {
        code: "VALIDATION",
        status: 409,
      });
    }
    throw error;
  }
}

/** Bulk-create AI-generated tasks (source = AI). */
export async function createAiTasks(
  userId: string,
  items: Array<{
    title: string;
    description?: string | null;
    priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT" | null;
    dueInDays?: number | null;
  }>,
): Promise<TaskDto[]> {
  const created: TaskDto[] = [];
  for (const item of items) {
    const dueAt =
      item.dueInDays === null || item.dueInDays === undefined
        ? undefined
        : addDays(new Date(), item.dueInDays).toISOString();
    const task = await createTask(userId, {
      title: item.title,
      description: item.description ?? undefined,
      priority: item.priority ?? undefined,
      dueAt,
    });
    await getDb().task.update({ where: { id: task.id }, data: { source: "AI" } });
    created.push({ ...task, source: "AI" });
  }
  return created;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
