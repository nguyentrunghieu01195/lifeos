import { describe, expect, it } from "vitest";

import {
  addDays,
  bestDailyStreak,
  bestWeeklyStreak,
  buildHeatmap,
  buildMiniHeatmap,
  dailyStreak,
  daysBetween,
  subtractDays,
  thisWeekCount,
  weeklyStreak,
} from "./streak";

const TODAY = "2026-07-27";

describe("date helpers", () => {
  it("adds days correctly across month and year boundaries", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(subtractDays("2026-03-01", 1)).toBe("2026-02-28");
  });

  it("computes daysBetween correctly", () => {
    expect(daysBetween("2026-07-27", "2026-07-27")).toBe(0);
    expect(daysBetween("2026-07-27", "2026-07-20")).toBe(7);
    expect(daysBetween("2027-01-01", "2026-12-31")).toBe(1);
  });
});

describe("dailyStreak", () => {
  it("returns 0 for no completions", () => {
    expect(dailyStreak([], TODAY)).toBe(0);
  });

  it("counts from today when today is done", () => {
    const dates = [subtractDays(TODAY, 2), subtractDays(TODAY, 1), TODAY];
    expect(dailyStreak(dates, TODAY)).toBe(3);
  });

  it("counts from yesterday as grace when today is not done", () => {
    const dates = [subtractDays(TODAY, 2), subtractDays(TODAY, 1)];
    expect(dailyStreak(dates, TODAY)).toBe(2);
  });

  it("breaks streak on a gap", () => {
    // Gap at today-2, only today and yesterday form the streak
    const dates = [subtractDays(TODAY, 4), subtractDays(TODAY, 1), TODAY];
    expect(dailyStreak(dates, TODAY)).toBe(2);
  });

  it("handles a single old completion", () => {
    expect(dailyStreak([subtractDays(TODAY, 30)], TODAY)).toBe(0);
  });
});

describe("bestDailyStreak", () => {
  it("finds the longest run", () => {
    const dates = [
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
    ];
    expect(bestDailyStreak(dates)).toBe(5);
  });

  it("handles a single date", () => {
    expect(bestDailyStreak([TODAY])).toBe(1);
  });

  it("returns 0 for empty input", () => {
    expect(bestDailyStreak([])).toBe(0);
  });
});

describe("weeklyStreak", () => {
  it("returns 0 for no completions", () => {
    expect(weeklyStreak([], 3, TODAY)).toBe(0);
  });

  it("counts current week when it already meets target", () => {
    // 3 completions in the last 7 days
    const dates = [subtractDays(TODAY, 2), subtractDays(TODAY, 1), TODAY];
    expect(weeklyStreak(dates, 3, TODAY)).toBe(1);
  });

  it("skips current week when it hasn't met target yet", () => {
    // Only 2 this week (need 3), but last week had 4
    const dates = [
      subtractDays(TODAY, 1),
      subtractDays(TODAY, 0),
      // last week
      subtractDays(TODAY, 8),
      subtractDays(TODAY, 9),
      subtractDays(TODAY, 10),
      subtractDays(TODAY, 11),
    ];
    expect(weeklyStreak(dates, 3, TODAY)).toBe(1);
  });

  it("counts multiple consecutive weeks", () => {
    const dates: string[] = [];
    for (let i = 0; i < 3; i++) {
      // 3 completions in each of the last 3 weeks
      dates.push(subtractDays(TODAY, i * 7));
      dates.push(subtractDays(TODAY, i * 7 + 1));
      dates.push(subtractDays(TODAY, i * 7 + 2));
    }
    expect(weeklyStreak(dates, 3, TODAY)).toBe(3);
  });

  it("breaks on a week that didn't meet target", () => {
    const dates: string[] = [];
    // This week and 2 weeks ago: OK. Last week: only 1 completion (gap).
    [0, 1, 2].forEach((i) => dates.push(subtractDays(TODAY, i)));
    dates.push(subtractDays(TODAY, 7)); // last week: only 1 (need 3)
    [0, 1, 2].forEach((i) => dates.push(subtractDays(TODAY, 14 + i)));
    expect(weeklyStreak(dates, 3, TODAY)).toBe(1);
  });
});

describe("thisWeekCount", () => {
  it("counts completions in the last 7 days", () => {
    const dates = [
      subtractDays(TODAY, 6),
      subtractDays(TODAY, 3),
      TODAY,
      subtractDays(TODAY, 8), // outside window
    ];
    expect(thisWeekCount(dates, TODAY)).toBe(3);
  });
});

describe("bestWeeklyStreak", () => {
  it("finds the longest run of successful weeks", () => {
    const dates: string[] = [];
    // Weeks 5-3 ago: meet target; week 2: fail; weeks 1-0: meet
    for (let w = 3; w <= 5; w++) {
      for (let d = 0; d < 3; d++) dates.push(subtractDays(TODAY, w * 7 + d));
    }
    for (let d = 0; d < 3; d++) dates.push(subtractDays(TODAY, d));
    expect(bestWeeklyStreak(dates, 3, TODAY)).toBe(3);
  });
});

describe("buildHeatmap", () => {
  it("returns exactly `days` cells ordered oldest to newest", () => {
    const cells = buildHeatmap([], TODAY, 7);
    expect(cells).toHaveLength(7);
    expect(cells[0]?.date).toBe(subtractDays(TODAY, 6));
    expect(cells[6]?.date).toBe(TODAY);
  });

  it("marks completed days correctly", () => {
    const dates = [subtractDays(TODAY, 2), TODAY];
    const cells = buildHeatmap(dates, TODAY, 7);
    expect(cells.find((c) => c.date === subtractDays(TODAY, 2))?.completed).toBe(true);
    expect(cells.find((c) => c.date === subtractDays(TODAY, 1))?.completed).toBe(false);
    expect(cells.find((c) => c.date === TODAY)?.completed).toBe(true);
  });

  it("buildMiniHeatmap returns 14 cells", () => {
    expect(buildMiniHeatmap([], TODAY)).toHaveLength(14);
  });
});
