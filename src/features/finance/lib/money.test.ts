import { describe, expect, it } from "vitest";

import {
  addMonths,
  currentMonthKey,
  dateStringToUtc,
  formatMonthKey,
  isMonthKey,
  MAX_AMOUNT_MINOR,
  monthRangeUtc,
  parseAmountInput,
  toAmountNumber,
  utcToDateString,
} from "./money";

describe("parseAmountInput", () => {
  it("accepts common Vietnamese formats", () => {
    expect(parseAmountInput("1500000")).toBe(1_500_000);
    expect(parseAmountInput("1.500.000")).toBe(1_500_000);
    expect(parseAmountInput("1,500,000")).toBe(1_500_000);
    expect(parseAmountInput("1 500 000")).toBe(1_500_000);
  });

  it("rejects junk, zero and out-of-range values", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("-500")).toBeNull();
    expect(parseAmountInput("0")).toBeNull();
    expect(parseAmountInput("12.5tr")).toBeNull();
    expect(parseAmountInput(String(MAX_AMOUNT_MINOR + 1))).toBeNull();
  });
});

describe("month keys", () => {
  it("validates the YYYY-MM shape", () => {
    expect(isMonthKey("2026-07")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-7")).toBe(false);
    expect(isMonthKey("garbage")).toBe(false);
  });

  it("does month arithmetic across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-07", -6)).toBe("2026-01");
  });

  it("builds UTC ranges that cover exactly one month", () => {
    const { start, end } = monthRangeUtc("2026-02");
    expect(start.toISOString()).toBe("2026-02-01T00:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("derives the current month from local time", () => {
    expect(currentMonthKey(new Date(2026, 6, 27))).toBe("2026-07");
  });

  it("formats headers", () => {
    expect(formatMonthKey("2026-07")).toBe("Jul 2026");
  });
});

describe("date-only round trip", () => {
  it("stores at UTC midnight and reads the same calendar day back", () => {
    const stored = dateStringToUtc("2026-07-27");
    expect(stored.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(utcToDateString(stored)).toBe("2026-07-27");
  });
});

describe("toAmountNumber", () => {
  it("converts bigints and guards the safe range", () => {
    expect(toAmountNumber(1_500_000n)).toBe(1_500_000);
    expect(() => toAmountNumber(BigInt(Number.MAX_SAFE_INTEGER) + 1n)).toThrow();
  });
});
