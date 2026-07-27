import { describe, expect, it } from "vitest";

import { parseAiTasks } from "@/features/tasks/lib/ai-parse";

describe("parseAiTasks", () => {
  it("parses a valid response", () => {
    const result = parseAiTasks(
      JSON.stringify({
        tasks: [
          { title: "Book venue", priority: "HIGH", dueInDays: 3 },
          { title: "Send invites", description: "Email + group chat" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.tasks).toHaveLength(2);
      expect(result.tasks[0]?.title).toBe("Book venue");
    }
  });

  it("tolerates markdown code fences", () => {
    const result = parseAiTasks('```json\n{"tasks":[{"title":"One"}]}\n```');
    expect(result.ok).toBe(true);
  });

  it("rejects non-JSON responses", () => {
    const result = parseAiTasks("Sure! Here are your tasks: 1. Do a thing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("not valid JSON");
  });

  it("rejects JSON that misses the contract", () => {
    expect(parseAiTasks('{"items":[{"title":"x"}]}').ok).toBe(false);
    expect(parseAiTasks('{"tasks":[]}').ok).toBe(false);
    expect(parseAiTasks('{"tasks":[{"title":""}]}').ok).toBe(false);
    expect(parseAiTasks(JSON.stringify({ tasks: [{ title: "x", dueInDays: 9999 }] })).ok).toBe(
      false,
    );
  });
});
