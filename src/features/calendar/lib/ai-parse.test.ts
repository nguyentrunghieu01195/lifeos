import { describe, expect, it } from "vitest";

import { parseAiEvents } from "@/features/calendar/lib/ai-parse";

describe("parseAiEvents", () => {
  it("parses a valid response", () => {
    const result = parseAiEvents(
      JSON.stringify({
        events: [
          { title: "Dentist", date: "2026-08-04", startTime: "15:00", endTime: "15:45" },
          { title: "Team offsite", date: "2026-08-10", startTime: "09:00", allDay: true },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events).toHaveLength(2);
      expect(result.events[0]?.title).toBe("Dentist");
    }
  });

  it("tolerates markdown fences and rejects malformed payloads", () => {
    expect(
      parseAiEvents(
        '```json\n{"events":[{"title":"A","date":"2026-01-01","startTime":"08:00"}]}\n```',
      ).ok,
    ).toBe(true);
    expect(parseAiEvents("not json").ok).toBe(false);
    expect(parseAiEvents('{"events":[]}').ok).toBe(false);
    expect(
      parseAiEvents(
        JSON.stringify({ events: [{ title: "x", date: "tomorrow", startTime: "09:00" }] }),
      ).ok,
    ).toBe(false);
    expect(
      parseAiEvents(
        JSON.stringify({ events: [{ title: "x", date: "2026-01-01", startTime: "9am" }] }),
      ).ok,
    ).toBe(false);
  });
});
