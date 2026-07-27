export type { ActionResult } from "@/types/actions";
export type { TrendPoint } from "./lib/summary";

export type TransactionTypeDto = "INCOME" | "EXPENSE";

export interface CategoryDto {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: TransactionTypeDto;
}

export interface TransactionDto {
  id: string;
  type: TransactionTypeDto;
  /** Minor units (VND đồng). */
  amountMinor: number;
  note: string;
  /** Date-only, "YYYY-MM-DD". */
  date: string;
  category: Pick<CategoryDto, "id" | "name" | "icon" | "color"> | null;
}

export interface BudgetDto {
  id: string;
  /** Null = the overall monthly budget. */
  categoryId: string | null;
  month: string;
  amountMinor: number;
}

/** Expense total for one slice of the donut. */
export interface CategorySpendDto {
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  total: number;
}

/** Everything the /finance page needs for one month. */
export interface MonthOverviewDto {
  month: string;
  income: number;
  expense: number;
  byCategory: CategorySpendDto[];
  trend: import("./lib/summary").TrendPoint[];
}

/** One AI categorization suggestion awaiting user review. */
export interface CategorySuggestionDto {
  transactionId: string;
  note: string;
  amountMinor: number;
  type: TransactionTypeDto;
  /** Null when the AI could not pick a fitting category. */
  categoryId: string | null;
}
