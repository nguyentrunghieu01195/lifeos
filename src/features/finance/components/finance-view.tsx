"use client";

import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useFinance, useInvalidateFinance, type FinanceSnapshot } from "../hooks";
import { addMonths, currentMonthKey, formatMonthKey } from "../lib/money";
import { createStarterCategoriesAction } from "../server/actions";
import type { BudgetDto, CategoryDto, MonthOverviewDto, TransactionDto } from "../types";
import { BudgetsTab } from "./budgets-tab";
import { OverviewTab } from "./overview-tab";
import { TransactionsTab } from "./transactions-tab";

const TABS = ["overview", "transactions", "budgets"] as const;
type TabId = (typeof TABS)[number];

interface FinanceViewProps {
  month: string;
  overview: MonthOverviewDto;
  transactions: TransactionDto[];
  categories: CategoryDto[];
  budgets: BudgetDto[];
}

export function FinanceView(props: FinanceViewProps) {
  const { month } = props;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [seeding, setSeeding] = useState(false);
  const invalidate = useInvalidateFinance();

  // RSC seeds the query; refetches after mutations come from /api/finance.
  const initial: FinanceSnapshot = {
    month,
    overview: props.overview,
    transactions: props.transactions,
    categories: props.categories,
    budgets: props.budgets,
  };
  const { data } = useFinance(month, initial);
  const { overview, transactions, categories, budgets } = data;

  const requestedTab = searchParams.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(requestedTab ?? "")
    ? (requestedTab as TabId)
    : "overview";

  const navigate = (nextMonth: string, nextTab: TabId) => {
    const params = new URLSearchParams();
    if (nextMonth !== currentMonthKey()) params.set("month", nextMonth);
    if (nextTab !== "overview") params.set("tab", nextTab);
    const query = params.toString();
    startNavigation(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  };

  const seedCategories = async () => {
    setSeeding(true);
    const result = await createStarterCategoriesAction();
    setSeeding(false);
    if (result.ok) {
      invalidate();
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={tab} onValueChange={(next) => navigate(month, next as TabId)}>
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="budgets">Budgets</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="ml-auto flex items-center gap-1">
          {navigating ? (
            <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
          ) : null}
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Previous month"
            onClick={() => navigate(addMonths(month, -1), tab)}
          >
            <ChevronLeft aria-hidden className="size-4" />
          </Button>
          <span className="w-24 text-center text-sm font-semibold tabular-nums">
            {formatMonthKey(month)}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Next month"
            onClick={() => navigate(addMonths(month, 1), tab)}
          >
            <ChevronRight aria-hidden className="size-4" />
          </Button>
          {month !== currentMonthKey() ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground"
              onClick={() => navigate(currentMonthKey(), tab)}
            >
              Today
            </Button>
          ) : null}
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border glass p-3 text-sm">
          <Sparkles aria-hidden className="size-4 text-muted-foreground" />
          <span className="flex-1">
            Start with a sensible set of categories — budgets, charts and AI suggestions all build
            on them.
          </span>
          <Button size="sm" onClick={() => void seedCategories()} disabled={seeding}>
            {seeding ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Add starter categories
          </Button>
        </div>
      ) : null}

      {tab === "overview" ? <OverviewTab overview={overview} /> : null}
      {tab === "transactions" ? (
        <TransactionsTab
          key={month}
          month={month}
          transactions={transactions}
          categories={categories}
          onMutated={invalidate}
        />
      ) : null}
      {tab === "budgets" ? (
        <BudgetsTab
          month={month}
          budgets={budgets}
          categories={categories}
          overview={overview}
          onMutated={invalidate}
        />
      ) : null}
    </div>
  );
}
