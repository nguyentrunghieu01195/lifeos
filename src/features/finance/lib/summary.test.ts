import { describe, expect, it } from "vitest";

import { buildTrend, groupExpensesByCategory, sumByType, type LedgerRow } from "./summary";

const rows: LedgerRow[] = [
  { type: "INCOME", amountMinor: 30_000_000, month: "2026-06", categoryId: "salary" },
  { type: "EXPENSE", amountMinor: 5_000_000, month: "2026-06", categoryId: "food" },
  { type: "EXPENSE", amountMinor: 2_000_000, month: "2026-07", categoryId: "food" },
  { type: "EXPENSE", amountMinor: 3_500_000, month: "2026-07", categoryId: "rent" },
  { type: "EXPENSE", amountMinor: 400_000, month: "2026-07", categoryId: null },
  { type: "INCOME", amountMinor: 30_000_000, month: "2026-07", categoryId: "salary" },
];

describe("buildTrend", () => {
  it("fills every month in the range, including empty ones", () => {
    const trend = buildTrend(rows, "2026-05", "2026-07");
    expect(trend.map((point) => point.month)).toEqual(["2026-05", "2026-06", "2026-07"]);
    expect(trend[0]).toEqual({ month: "2026-05", income: 0, expense: 0 });
    expect(trend[1]).toEqual({ month: "2026-06", income: 30_000_000, expense: 5_000_000 });
    expect(trend[2]).toEqual({ month: "2026-07", income: 30_000_000, expense: 5_900_000 });
  });

  it("ignores rows outside the range", () => {
    const trend = buildTrend(rows, "2026-07", "2026-07");
    expect(trend).toHaveLength(1);
    expect(trend[0]?.expense).toBe(5_900_000);
  });
});

describe("groupExpensesByCategory", () => {
  it("sums expenses per category, largest first, keeping uncategorized", () => {
    const july = rows.filter((row) => row.month === "2026-07");
    const grouped = groupExpensesByCategory(july);
    expect(grouped).toEqual([
      { categoryId: "rent", total: 3_500_000 },
      { categoryId: "food", total: 2_000_000 },
      { categoryId: null, total: 400_000 },
    ]);
  });

  it("never counts income", () => {
    expect(
      groupExpensesByCategory(rows).find((entry) => entry.categoryId === "salary"),
    ).toBeUndefined();
  });
});

describe("sumByType", () => {
  it("totals both sides of the ledger", () => {
    expect(sumByType(rows)).toEqual({ income: 60_000_000, expense: 10_900_000 });
  });
});
