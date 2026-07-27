import { describe, expect, it } from "vitest";

import { dateFromLocalParts, eventBlockPosition } from "@/features/calendar/lib/time";

describe("eventBlockPosition", () => {
  const day = new Date(2026, 6, 27);

  it("positions a 9:00-10:30 event correctly", () => {
    const { topPct, heightPct } = eventBlockPosition(
      new Date(2026, 6, 27, 9, 0),
      new Date(2026, 6, 27, 10, 30),
      day,
    );
    expect(topPct).toBeCloseTo((9 / 24) * 100, 5);
    expect(heightPct).toBeCloseTo((1.5 / 24) * 100, 5);
  });

  it("clamps events spilling past midnight to the visible day", () => {
    const { topPct, heightPct } = eventBlockPosition(
      new Date(2026, 6, 27, 23, 0),
      new Date(2026, 6, 28, 2, 0),
      day,
    );
    expect(topPct + heightPct).toBeLessThanOrEqual(100.0001);
  });

  it("gives zero-length events a visible minimum height", () => {
    const { heightPct } = eventBlockPosition(
      new Date(2026, 6, 27, 12, 0),
      new Date(2026, 6, 27, 12, 0),
      day,
    );
    expect(heightPct).toBeGreaterThan(0);
  });
});

describe("dateFromLocalParts", () => {
  it("builds the correct UTC instant for a positive-offset timezone (ICT, UTC+7)", () => {
    // 15:00 local in UTC+7 => 08:00 UTC. getTimezoneOffset() for UTC+7 is -420.
    const date = dateFromLocalParts("2026-07-28", "15:00", -420);
    expect(date.toISOString()).toBe("2026-07-28T08:00:00.000Z");
  });

  it("handles UTC and negative-offset timezones", () => {
    expect(dateFromLocalParts("2026-07-28", "09:30", 0).toISOString()).toBe(
      "2026-07-28T09:30:00.000Z",
    );
    // New York summer (UTC-4): offset +240 → 09:00 local = 13:00 UTC.
    expect(dateFromLocalParts("2026-07-28", "09:00", 240).toISOString()).toBe(
      "2026-07-28T13:00:00.000Z",
    );
  });
});
