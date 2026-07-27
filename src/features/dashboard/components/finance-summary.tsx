import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/features/finance/lib/money";
import { cn } from "@/lib/utils";

interface FinanceSummaryCardProps {
  income: number;
  expense: number;
  topCategory: { name: string; icon: string; total: number } | null;
}

/** Dashboard widget: this month's money at a glance. */
export function FinanceSummaryCard({ income, expense, topCategory }: FinanceSummaryCardProps) {
  const net = income - expense;
  const empty = income === 0 && expense === 0;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>This month&apos;s money</CardTitle>
        <CardDescription>
          {empty ? "No transactions recorded yet." : "Income, spending and where it went."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet aria-hidden className="size-4" />
            Track your first expense to see the picture.
          </p>
        ) : (
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Income</dt>
              <dd className="font-mono text-emerald-600 tabular-nums dark:text-emerald-400">
                +{formatMoney(income)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Expenses</dt>
              <dd className="font-mono text-destructive tabular-nums">−{formatMoney(expense)}</dd>
            </div>
            <div className="flex justify-between border-t pt-1.5 font-medium">
              <dt>Net</dt>
              <dd
                className={cn(
                  "font-mono tabular-nums",
                  net < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatMoney(net)}
              </dd>
            </div>
            {topCategory ? (
              <div className="flex justify-between text-xs text-muted-foreground">
                <dt>Top category</dt>
                <dd>
                  {topCategory.icon} {topCategory.name} · {formatMoney(topCategory.total)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/finance">
            Open finance
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
