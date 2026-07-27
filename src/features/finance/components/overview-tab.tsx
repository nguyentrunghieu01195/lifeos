"use client";

import { ArrowDownRight, ArrowUpRight, PiggyBank, Scale } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatMoney } from "../lib/money";
import type { MonthOverviewDto } from "../types";
import { CategoryDonut, TrendChart } from "./finance-charts";

export function OverviewTab({ overview }: { overview: MonthOverviewDto }) {
  const net = overview.income - overview.expense;
  const hasExpenses = overview.byCategory.length > 0;
  const hasAnything = overview.income > 0 || overview.expense > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          label="Income"
          value={formatMoney(overview.income)}
          icon={<ArrowUpRight aria-hidden className="size-4 text-emerald-500" />}
        />
        <StatCard
          label="Expenses"
          value={formatMoney(overview.expense)}
          icon={<ArrowDownRight aria-hidden className="size-4 text-destructive" />}
        />
        <StatCard
          label="Net"
          value={formatMoney(net)}
          icon={<Scale aria-hidden className="size-4 text-muted-foreground" />}
          valueClassName={net < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}
        />
      </div>

      {!hasAnything ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <PiggyBank aria-hidden className="size-6" />
          No transactions this month yet — add your first one in the Transactions tab.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="glass">
            <CardHeader>
              <CardTitle>Spending by category</CardTitle>
              <CardDescription>Where this month&apos;s money went.</CardDescription>
            </CardHeader>
            <CardContent>
              {hasExpenses ? (
                <>
                  <CategoryDonut data={overview.byCategory} />
                  <ul className="mt-2 space-y-1.5">
                    {overview.byCategory.slice(0, 6).map((entry) => (
                      <li
                        key={entry.categoryId ?? "uncategorized"}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span
                          aria-hidden
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="truncate">
                          {entry.icon} {entry.name}
                        </span>
                        <span className="ml-auto font-mono text-xs text-muted-foreground tabular-nums">
                          {formatMoney(entry.total)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No expenses recorded this month.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="glass">
            <CardHeader>
              <CardTitle>Cash flow</CardTitle>
              <CardDescription>Income vs expenses, last 6 months.</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart data={overview.trend} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClassName,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="gap-2 glass py-4">
      <CardContent className="space-y-1 px-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase">
          {icon}
          {label}
        </p>
        <p className={cn("truncate text-xl font-bold tabular-nums", valueClassName)}>{value}</p>
      </CardContent>
    </Card>
  );
}
