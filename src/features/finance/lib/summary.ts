import { addMonths } from "./money";

/**
 * Pure aggregation helpers — the service fetches rows, these functions do the
 * math, and unit tests pin the math down without a database.
 */

export interface LedgerRow {
  type: "INCOME" | "EXPENSE";
  amountMinor: number;
  /** "YYYY-MM" bucket the row belongs to. */
  month: string;
  categoryId: string | null;
}

export interface TrendPoint {
  month: string;
  income: number;
  expense: number;
}

/** Income/expense per month across an inclusive month-key range. */
export function buildTrend(rows: LedgerRow[], firstMonth: string, lastMonth: string): TrendPoint[] {
  const points = new Map<string, TrendPoint>();
  for (let month = firstMonth; month <= lastMonth; month = addMonths(month, 1)) {
    points.set(month, { month, income: 0, expense: 0 });
  }
  for (const row of rows) {
    const point = points.get(row.month);
    if (!point) continue;
    if (row.type === "INCOME") point.income += row.amountMinor;
    else point.expense += row.amountMinor;
  }
  return [...points.values()];
}

export interface CategoryTotal {
  categoryId: string | null;
  total: number;
}

/** Expense totals per category, largest first (null = uncategorized). */
export function groupExpensesByCategory(rows: LedgerRow[]): CategoryTotal[] {
  const totals = new Map<string | null, number>();
  for (const row of rows) {
    if (row.type !== "EXPENSE") continue;
    totals.set(row.categoryId, (totals.get(row.categoryId) ?? 0) + row.amountMinor);
  }
  return [...totals.entries()]
    .map(([categoryId, total]) => ({ categoryId, total }))
    .sort((a, b) => b.total - a.total);
}

export function sumByType(rows: LedgerRow[]): { income: number; expense: number } {
  let income = 0;
  let expense = 0;
  for (const row of rows) {
    if (row.type === "INCOME") income += row.amountMinor;
    else expense += row.amountMinor;
  }
  return { income, expense };
}
