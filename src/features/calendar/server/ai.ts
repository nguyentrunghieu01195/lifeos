import "server-only";

import { AppError } from "@/lib/errors";
import { completeWithRetry } from "@/services/ai";

import { parseAiEvents } from "../lib/ai-parse";
import type { AiScheduleInput } from "../schemas";
import type { EventDto } from "../types";
import { createAiEvents } from "./service";

function systemPrompt(todayDate: string): string {
  return `You are the LifeOS scheduler. Convert the user's request into calendar events.

Today's date for the user is ${todayDate}. Resolve every relative expression ("tomorrow", "next Tuesday", "in two weeks") against that date.

Respond with ONLY valid JSON in exactly this shape:
{"events":[{"title":"...","description":"...","location":"...","date":"YYYY-MM-DD","startTime":"HH:mm","endTime":"HH:mm","allDay":false}]}

Rules:
- 1 to 12 events; concise titles (max 200 chars).
- "date" is the event's local calendar date; "startTime"/"endTime" are 24h local wall-clock times.
- "description", "location", "endTime" and "allDay" are optional; omit when unsure. Default meetings to one hour by omitting endTime.
- Never schedule in the past relative to today.
- No markdown, no commentary — JSON only.`;
}

/** Schedule events from a natural-language prompt via the AI gateway. */
export async function scheduleEventsFromPrompt(
  userId: string,
  input: AiScheduleInput,
): Promise<EventDto[]> {
  const completion = await completeWithRetry({
    messages: [
      { role: "system", content: systemPrompt(input.todayDate) },
      { role: "user", content: input.prompt },
    ],
    jsonMode: true,
    temperature: 0.3,
    maxOutputTokens: 1500,
  });

  const parsed = parseAiEvents(completion.text);
  if (!parsed.ok) {
    throw new AppError(`${parsed.error} Try rephrasing your request.`, {
      code: "AI_PROVIDER",
      status: 502,
    });
  }
  return createAiEvents(userId, parsed.events, input.tzOffsetMinutes);
}
