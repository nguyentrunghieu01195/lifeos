import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import type { HabitSuggestionDto } from "../types";

const SYSTEM_PROMPT = `You are a habit formation coach. Suggest 3-5 specific, actionable habits to help the user reach their goal.

Respond with ONLY valid JSON in exactly this shape:
{"habits":[{"name":"...","icon":"...","frequency":"DAILY|WEEKLY","targetCount":1,"reason":"..."}]}

Rules:
- name: concise action phrase, max 50 chars (e.g. "Read 20 pages", "30-minute walk")
- icon: a single relevant emoji
- frequency: DAILY or WEEKLY
- targetCount: how many times per week (1–7; for DAILY always 1, ignored; for WEEKLY typically 2–5)
- reason: 1 sentence explaining how this habit helps the goal
- Suggest habits in the user's language (Vietnamese or English)
- No markdown, no commentary — JSON only.`;

export async function suggestHabits(goal: string): Promise<HabitSuggestionDto[]> {
  const completion = await completeWithRetry({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: goal },
    ],
    jsonMode: true,
    temperature: 0.5,
    maxOutputTokens: 800,
  });

  let parsed: unknown;
  try {
    const raw = completion.text
      .trim()
      .replace(/^```(?:json)?\s*/m, "")
      .replace(/\s*```$/m, "");
    parsed = JSON.parse(raw);
  } catch {
    throw new AppError("The AI returned malformed JSON — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }

  const habits = (parsed as { habits?: unknown }).habits;
  if (!Array.isArray(habits) || habits.length === 0) {
    throw new AppError("The AI didn't suggest any habits — try again.", {
      code: "AI_PROVIDER",
      status: 502,
    });
  }

  return habits
    .slice(0, 5)
    .filter(
      (item): item is HabitSuggestionDto =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).icon === "string" &&
        ["DAILY", "WEEKLY"].includes(String((item as Record<string, unknown>).frequency)),
    )
    .map((item) => ({
      name: String(item.name).slice(0, 60),
      icon: String(item.icon).slice(0, 8),
      frequency: item.frequency,
      targetCount:
        typeof item.targetCount === "number" ? Math.min(Math.max(1, item.targetCount), 7) : 3,
      reason: typeof item.reason === "string" ? item.reason.slice(0, 200) : "",
    }));
}
