"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { BudgetDto, CategoryDto, MonthOverviewDto, TransactionDto } from "./types";

/**
 * Client data layer for finance: one query per month, seeded from RSC.
 * Mutations go through server actions and then invalidate this query — a
 * plain JSON refetch, immune to the flight-payload races that made
 * revalidation-only updates unreliable on URLs with search params.
 */

export interface FinanceSnapshot {
  month: string;
  overview: MonthOverviewDto;
  transactions: TransactionDto[];
  categories: CategoryDto[];
  budgets: BudgetDto[];
}

export const FINANCE_QUERY_PREFIX = ["finance"] as const;

export function financeQueryKey(month: string) {
  return [...FINANCE_QUERY_PREFIX, month] as const;
}

async function fetchFinance(month: string): Promise<FinanceSnapshot> {
  const response = await fetch(`/api/finance?month=${encodeURIComponent(month)}`);
  if (!response.ok) {
    throw new Error("Failed to load finance data.");
  }
  return (await response.json()) as FinanceSnapshot;
}

export function useFinance(month: string, initial: FinanceSnapshot) {
  return useQuery({
    queryKey: financeQueryKey(month),
    queryFn: () => fetchFinance(month),
    initialData: initial,
    staleTime: 15_000,
  });
}

/** Invalidate every month's snapshot — mutations can move money across months. */
export function useInvalidateFinance(): () => void {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: FINANCE_QUERY_PREFIX });
  };
}
