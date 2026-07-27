import { z } from "zod";

/** Validation for the tasks boundary — used by forms and re-run in actions. */

export const taskStatusSchema = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
export const taskPrioritySchema = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const recurrenceFreqSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

const isoDate = z.string().datetime({ offset: true });

export const createTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required.")
    .max(200, "Keep titles under 200 characters."),
  description: z.string().trim().max(4000).optional(),
  projectId: z.string().cuid().nullish(),
  parentId: z.string().cuid().nullish(),
  priority: taskPrioritySchema.optional(),
  status: taskStatusSchema.optional(),
  dueAt: isoDate.nullish(),
  reminderAt: isoDate.nullish(),
  recurrenceFreq: recurrenceFreqSchema.nullish(),
  recurrenceInterval: z.number().int().min(1).max(99).nullish(),
  tagIds: z.array(z.string().cuid()).max(20).optional(),
});

export const updateTaskSchema = createTaskSchema.partial().extend({
  id: z.string().cuid(),
});

export const moveTaskSchema = z.object({
  id: z.string().cuid(),
  status: taskStatusSchema,
  position: z.number().finite(),
});

export const createSubtaskSchema = z.object({
  parentId: z.string().cuid(),
  title: z.string().trim().min(1).max(200),
});

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1.")
    .optional(),
});

export const createTagSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(40),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #0ea5e9.")
    .optional(),
});

export const aiGenerateSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Describe what you want to plan.")
    .max(1000, "Keep the prompt under 1000 characters."),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
