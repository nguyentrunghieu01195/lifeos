import { z } from "zod";

import { taskPrioritySchema } from "../schemas";

/** Contract for the AI task-planner response (requested via jsonMode). */
export const aiTaskItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  priority: taskPrioritySchema.nullish(),
  dueInDays: z.number().int().min(0).max(365).nullish(),
});

export const aiTasksResponseSchema = z.object({
  tasks: z.array(aiTaskItemSchema).min(1).max(20),
});

export type AiTaskItem = z.infer<typeof aiTaskItemSchema>;

export type AiParseResult = { ok: true; tasks: AiTaskItem[] } | { ok: false; error: string };

/**
 * Parse a model response into task items. Tolerates markdown code fences;
 * rejects anything that doesn't match the contract.
 */
export function parseAiTasks(text: string): AiParseResult {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { ok: false, error: "The AI response was not valid JSON." };
  }

  const result = aiTasksResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "The AI response did not match the expected task format." };
  }
  return { ok: true, tasks: result.data.tasks };
}
