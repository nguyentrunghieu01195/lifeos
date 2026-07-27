import { describe, expect, it } from "vitest";

import { computeRange, stepCursor } from "@/features/calendar/lib/range";

// Monday 2026-07-27 12:00 local.
const cursor = new Date(2026, 6, 27, 12, 0, 0);

describe("computeRange", () => {
  it("month view spans whole weeks around the month", () => {
    const { from, to } = computeRange("month", cursor);
    expect(from.getDay()).toBe(1); // Monday
    expect(from <= new Date(2026, 6, 1)).toBe(true);
    expect(to >= new Date(2026, 6, 31)).toBe(true);
  });

  it("week view spans Monday to Sunday", () => {
    const { from, to } = computeRange("week", cursor);
    expect(from).toEqual(new Date(2026, 6, 27, 0, 0, 0, 0));
    expect(to.getDay()).toBe(0); // Sunday
  });

  it("day view spans a single day", () => {
    const { from, to } = computeRange("day", cursor);
    expect(from).toEqual(new Date(2026, 6, 27, 0, 0, 0, 0));
    expect(to.getDate()).toBe(27);
    expect(to.getHours()).toBe(23);
  });

  it("agenda spans 30 days", () => {
    const { from, to } = computeRange("agenda", cursor);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(30);
  });
});

describe("stepCursor", () => {
  it("steps by view-appropriate amounts in both directions", () => {
    expect(stepCursor("month", cursor, 1).getMonth()).toBe(7);
    expect(stepCursor("month", cursor, -1).getMonth()).toBe(5);
    expect(stepCursor("week", cursor, 1).getDate()).toBe(3); // Aug 3
    expect(stepCursor("day", cursor, 1).getDate()).toBe(28);
    expect(stepCursor("agenda", cursor, 1).getMonth()).toBe(7);
  });
});
