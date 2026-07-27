import { describe, expect, it } from "vitest";

import { nextOccurrence } from "@/features/tasks/lib/recurrence";

describe("nextOccurrence", () => {
  const due = new Date("2026-07-27T09:00:00.000Z");

  it("steps by the frequency and interval", () => {
    expect(nextOccurrence(due, "DAILY", 1, due)).toEqual(new Date("2026-07-28T09:00:00.000Z"));
    expect(nextOccurrence(due, "WEEKLY", 2, due)).toEqual(new Date("2026-08-10T09:00:00.000Z"));
    expect(nextOccurrence(due, "MONTHLY", 1, due)).toEqual(new Date("2026-08-27T09:00:00.000Z"));
    expect(nextOccurrence(due, "YEARLY", 1, due)).toEqual(new Date("2027-07-27T09:00:00.000Z"));
  });

  it("catches up past the reference date for long-overdue tasks", () => {
    const overdue = new Date("2026-01-01T09:00:00.000Z");
    const reference = new Date("2026-07-27T12:00:00.000Z");
    const next = nextOccurrence(overdue, "WEEKLY", 1, reference);
    expect(next.getTime()).toBeGreaterThan(reference.getTime());
    // Still lands on the same weekday cadence as the original due date.
    expect(next.getUTCDay()).toBe(overdue.getUTCDay());
  });

  it("returns a strictly future date even when due equals the reference", () => {
    const next = nextOccurrence(due, "DAILY", 1, due);
    expect(next.getTime()).toBeGreaterThan(due.getTime());
  });
});
