"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { CreateTaskInput, MoveTaskInput, UpdateTaskInput } from "./schemas";
import {
  createTaskAction,
  deleteTaskAction,
  generateTasksAction,
  moveTaskAction,
  toggleTaskAction,
  updateTaskAction,
} from "./server/actions";
import type { ActionResult, TaskDto } from "./types";

/**
 * Client data layer for tasks: one query (seeded from RSC), mutations with
 * optimistic cache patches and rollback on failure. Server actions return
 * ActionResult envelopes; `unwrap` converts failures into thrown errors so
 * TanStack Query's onError/rollback machinery engages.
 */

export const TASKS_QUERY_KEY = ["tasks"] as const;

async function fetchTasks(): Promise<TaskDto[]> {
  const response = await fetch("/api/tasks");
  if (!response.ok) {
    throw new Error("Failed to load tasks.");
  }
  const json = (await response.json()) as { tasks: TaskDto[] };
  return json.tasks;
}

async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export function useTasks(initialTasks: TaskDto[]) {
  return useQuery({
    queryKey: TASKS_QUERY_KEY,
    queryFn: fetchTasks,
    initialData: initialTasks,
    staleTime: 15_000,
  });
}

async function snapshotAndPatch(
  queryClient: QueryClient,
  patch: (tasks: TaskDto[]) => TaskDto[],
): Promise<TaskDto[]> {
  await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY });
  const previous = queryClient.getQueryData<TaskDto[]>(TASKS_QUERY_KEY) ?? [];
  queryClient.setQueryData<TaskDto[]>(TASKS_QUERY_KEY, patch(previous));
  return previous;
}

function replaceTask(tasks: TaskDto[], task: TaskDto, tempId?: string): TaskDto[] {
  return tasks.map((existing) => (existing.id === (tempId ?? task.id) ? task : existing));
}

interface MutationContext {
  previous: TaskDto[];
  tempId?: string;
}

export function useTaskMutations() {
  const queryClient = useQueryClient();

  const rollback = (error: Error, _variables: unknown, context: MutationContext | undefined) => {
    if (context) {
      queryClient.setQueryData(TASKS_QUERY_KEY, context.previous);
    }
    toast.error(error.message);
  };

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
  };

  const create = useMutation({
    mutationFn: (input: CreateTaskInput) => unwrap(createTaskAction(input)),
    onMutate: async (input): Promise<MutationContext> => {
      const tempId = `tmp_${Date.now()}`;
      const optimistic: TaskDto = {
        id: tempId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "TODO",
        priority: input.priority ?? "MEDIUM",
        source: "MANUAL",
        position: Number.MAX_SAFE_INTEGER,
        dueAt: input.dueAt ?? null,
        reminderAt: input.reminderAt ?? null,
        completedAt: null,
        recurrenceFreq: input.recurrenceFreq ?? null,
        recurrenceInterval: input.recurrenceInterval ?? null,
        projectId: input.projectId ?? null,
        parentId: input.parentId ?? null,
        project: null,
        tags: [],
        subtasks: [],
        createdAt: new Date().toISOString(),
      };
      const previous = await snapshotAndPatch(queryClient, (tasks) => [...tasks, optimistic]);
      return { previous, tempId };
    },
    onError: rollback,
    onSuccess: (task, _variables, context) => {
      queryClient.setQueryData<TaskDto[]>(TASKS_QUERY_KEY, (tasks) =>
        replaceTask(tasks ?? [], task, context?.tempId),
      );
    },
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: (input: UpdateTaskInput) => unwrap(updateTaskAction(input)),
    onMutate: async (input): Promise<MutationContext> => ({
      previous: await snapshotAndPatch(queryClient, (tasks) =>
        tasks.map((task) =>
          task.id === input.id
            ? {
                ...task,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.description !== undefined
                  ? { description: input.description ?? null }
                  : {}),
                ...(input.priority !== undefined ? { priority: input.priority } : {}),
                ...(input.status !== undefined ? { status: input.status } : {}),
                ...(input.dueAt !== undefined ? { dueAt: input.dueAt ?? null } : {}),
                ...(input.reminderAt !== undefined ? { reminderAt: input.reminderAt ?? null } : {}),
              }
            : task,
        ),
      ),
    }),
    onError: rollback,
    onSuccess: (task) => {
      queryClient.setQueryData<TaskDto[]>(TASKS_QUERY_KEY, (tasks) =>
        replaceTask(tasks ?? [], task),
      );
    },
    onSettled: settle,
  });

  const toggle = useMutation({
    mutationFn: (id: string) => unwrap(toggleTaskAction(id)),
    onMutate: async (id): Promise<MutationContext> => ({
      previous: await snapshotAndPatch(queryClient, (tasks) =>
        tasks.map((task) =>
          task.id === id
            ? { ...task, status: task.status === "DONE" ? "TODO" : "DONE" }
            : {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === id
                    ? { ...subtask, status: subtask.status === "DONE" ? "TODO" : "DONE" }
                    : subtask,
                ),
              },
        ),
      ),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const move = useMutation({
    mutationFn: (input: MoveTaskInput) => unwrap(moveTaskAction(input)),
    onMutate: async (input): Promise<MutationContext> => ({
      previous: await snapshotAndPatch(queryClient, (tasks) =>
        tasks
          .map((task) =>
            task.id === input.id
              ? { ...task, status: input.status, position: input.position }
              : task,
          )
          .sort((a, b) => a.position - b.position),
      ),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteTaskAction(id)),
    onMutate: async (id): Promise<MutationContext> => ({
      previous: await snapshotAndPatch(queryClient, (tasks) =>
        tasks.filter((task) => task.id !== id),
      ),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const generate = useMutation({
    mutationFn: (prompt: string) => unwrap(generateTasksAction({ prompt })),
    onSuccess: (tasks) => {
      toast.success(`Added ${tasks.length} task${tasks.length === 1 ? "" : "s"} from AI.`);
    },
    onSettled: settle,
  });

  return { create, update, toggle, move, remove, generate };
}
