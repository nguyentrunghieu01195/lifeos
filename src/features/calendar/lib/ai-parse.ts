import { z } from "zod";

/** Contract for the AI scheduler response (requested via jsonMode). */
export const aiEventItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).nullish(),
  location: z.string().trim().max(200).nullish(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullish(),
  allDay: z.boolean().nullish(),
});

export const aiEventsResponseSchema = z.object({
  events: z.array(aiEventItemSchema).min(1).max(12),
});

export type AiEventItem = z.infer<typeof aiEventItemSchema>;

export type AiEventsParseResult =
  { ok: true; events: AiEventItem[] } | { ok: false; error: string };

export function parseAiEvents(text: string): AiEventsParseResult {
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

  const result = aiEventsResponseSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: "The AI response did not match the expected event format." };
  }
  return { ok: true, events: result.data.events };
}
