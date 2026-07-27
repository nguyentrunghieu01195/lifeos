import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import { parseAiTasks } from "../lib/ai-parse";
import type { TaskDto } from "../types";
import { createAiTasks } from "./service";

const SYSTEM_PROMPT = `You are the LifeOS task planner. Convert the user's request into a short list of actionable tasks.

Respond with ONLY valid JSON in exactly this shape:
{"tasks":[{"title":"...","description":"...","priority":"LOW|MEDIUM|HIGH|URGENT","dueInDays":0}]}

Rules:
- 1 to 12 tasks, imperative and concise titles (max 200 chars).
- "description", "priority" and "dueInDays" are optional; omit them when unsure.
- "dueInDays" counts days from today (0 = today). Only set it when the user's request implies timing.
- No markdown, no commentary — JSON only.`;

/** Generate tasks from a natural-language prompt via the AI gateway. */
export async function generateTasksFromPrompt(userId: string, prompt: string): Promise<TaskDto[]> {
  const completion = await completeWithRetry({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    jsonMode: true,
    temperature: 0.4,
    maxOutputTokens: 1500,
  });

  const parsed = parseAiTasks(completion.text);
  if (!parsed.ok) {
    throw new AppError(`${parsed.error} Try rephrasing your request.`, {
      code: "AI_PROVIDER",
      status: 502,
    });
  }
  return createAiTasks(userId, parsed.tasks);
}
