import { describe, expect, it } from "vitest";

import {
  bmiCategory,
  formatDuration,
  formatGlasses,
  formatHours,
  formatKg,
  sleepQualityLabel,
  sleepScore,
  WATER_DAILY_TARGET,
  waterProgressPercent,
  weightDelta,
  workoutSummary,
} from "./metrics";

describe("formatKg", () => {
  it("formats with one decimal place", () => {
    expect(formatKg(70.5)).toBe("70.5 kg");
    expect(formatKg(68)).toBe("68.0 kg");
  });
});

describe("bmiCategory", () => {
  it("returns correct categories", () => {
    expect(bmiCategory(45, 170)).toBe("Underweight");
    expect(bmiCategory(68, 170)).toBe("Normal");
    expect(bmiCategory(80, 170)).toBe("Overweight");
    expect(bmiCategory(100, 170)).toBe("Obese");
  });
});

describe("weightDelta", () => {
  it("returns null with fewer than 2 entries", () => {
    expect(weightDelta([])).toBeNull();
    expect(weightDelta([{ kg: 70 }])).toBeNull();
  });

  it("returns difference between first and last entry", () => {
    expect(weightDelta([{ kg: 72 }, { kg: 70 }])).toBeCloseTo(-2);
    expect(weightDelta([{ kg: 68 }, { kg: 70 }, { kg: 71 }])).toBeCloseTo(3);
  });
});

describe("formatHours", () => {
  it("formats sleep durations correctly", () => {
    expect(formatHours(8)).toBe("8h");
    expect(formatHours(7.5)).toBe("7h 30m");
    expect(formatHours(6)).toBe("6h");
  });
});

describe("sleepScore", () => {
  it("returns 100 for perfect sleep", () => {
    expect(sleepScore(8, 5)).toBe(100);
  });

  it("penalises short sleep and low quality", () => {
    const poorNight = sleepScore(4, 2);
    const goodNight = sleepScore(7.5, 4);
    expect(poorNight).toBeLessThan(goodNight);
  });

  it("clamps duration contribution at 8h", () => {
    const over8 = sleepScore(10, 5);
    const exactly8 = sleepScore(8, 5);
    expect(over8).toBe(exactly8);
  });
});

describe("sleepQualityLabel", () => {
  it("maps 1–5 to descriptive labels", () => {
    expect(sleepQualityLabel(1)).toBe("Poor");
    expect(sleepQualityLabel(5)).toBe("Excellent");
    expect(sleepQualityLabel(0)).toBe("—");
  });
});

describe("water helpers", () => {
  it("calculates progress percentage, capped at 100", () => {
    expect(waterProgressPercent(0)).toBe(0);
    expect(waterProgressPercent(WATER_DAILY_TARGET)).toBe(100);
    expect(waterProgressPercent(WATER_DAILY_TARGET + 2)).toBe(100);
    expect(waterProgressPercent(4)).toBe(50);
  });

  it("formats glass counts correctly", () => {
    expect(formatGlasses(1)).toBe("1 glass");
    expect(formatGlasses(5)).toBe("5 glasses");
  });
});

describe("formatDuration", () => {
  it("formats minutes and hours", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(90)).toBe("1h 30m");
  });
});

describe("workoutSummary", () => {
  it("sums sessions and minutes", () => {
    const workouts = [{ durationMinutes: 30 }, { durationMinutes: 45 }, { durationMinutes: 15 }];
    expect(workoutSummary(workouts)).toEqual({ sessions: 3, totalMinutes: 90 });
  });

  it("returns zeros for empty list", () => {
    expect(workoutSummary([])).toEqual({ sessions: 0, totalMinutes: 0 });
  });
});
