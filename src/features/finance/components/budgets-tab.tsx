"use client";

import { Loader2, PiggyBank } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { formatMoney, formatMonthKey, parseAmountInput } from "../lib/money";
import { setBudgetAction } from "../server/actions";
import type { BudgetDto, CategoryDto, MonthOverviewDto } from "../types";

interface BudgetsTabProps {
  month: string;
  budgets: BudgetDto[];
  categories: CategoryDto[];
  overview: MonthOverviewDto;
  /** Invalidates the finance query after a successful mutation. */
  onMutated: () => void;
}

interface BudgetTarget {
  categoryId: string | null;
  label: string;
  current: number;
}

export function BudgetsTab({ month, budgets, categories, overview, onMutated }: BudgetsTabProps) {
  const [target, setTarget] = useState<BudgetTarget | null>(null);

  const spentByCategory = new Map(
    overview.byCategory.map((entry) => [entry.categoryId, entry.total]),
  );
  const budgetByCategory = new Map(budgets.map((budget) => [budget.categoryId, budget]));

  const overall = budgetByCategory.get(null) ?? null;
  const expenseCategories = categories.filter((category) => category.type === "EXPENSE");

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader>
          <CardTitle>Overall budget — {formatMonthKey(month)}</CardTitle>
          <CardDescription>A ceiling for everything you spend this month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BudgetRow
            label="All spending"
            icon="🎯"
            color="var(--color-primary)"
            spent={overview.expense}
            budget={overall?.amountMinor ?? null}
            onEdit={() =>
              setTarget({
                categoryId: null,
                label: "All spending",
                current: overall?.amountMinor ?? 0,
              })
            }
          />
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle>Category budgets</CardTitle>
          <CardDescription>
            {expenseCategories.length === 0
              ? "Create expense categories in the Transactions tab first."
              : "Spending against each category's monthly limit."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {expenseCategories.length === 0 ? (
            <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <PiggyBank aria-hidden className="size-4" />
              No expense categories yet.
            </p>
          ) : (
            expenseCategories.map((category) => {
              const budget = budgetByCategory.get(category.id) ?? null;
              return (
                <BudgetRow
                  key={category.id}
                  label={category.name}
                  icon={category.icon}
                  color={category.color}
                  spent={spentByCategory.get(category.id) ?? 0}
                  budget={budget?.amountMinor ?? null}
                  onEdit={() =>
                    setTarget({
                      categoryId: category.id,
                      label: category.name,
                      current: budget?.amountMinor ?? 0,
                    })
                  }
                />
              );
            })
          )}
        </CardContent>
      </Card>

      <SetBudgetDialog
        month={month}
        target={target}
        onClose={() => setTarget(null)}
        onMutated={onMutated}
      />
    </div>
  );
}

function BudgetRow({
  label,
  icon,
  color,
  spent,
  budget,
  onEdit,
}: {
  label: string;
  icon: string;
  color: string;
  spent: number;
  budget: number | null;
  onEdit: () => void;
}) {
  const ratio = budget && budget > 0 ? spent / budget : null;
  const over = ratio !== null && ratio > 1;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm">
        <span aria-hidden>{icon}</span>
        <span className="truncate font-medium">{label}</span>
        <span
          className={cn(
            "ml-auto font-mono text-xs text-muted-foreground tabular-nums",
            over && "font-medium text-destructive",
          )}
        >
          {formatMoney(spent)}
          {budget !== null ? ` / ${formatMoney(budget)}` : ""}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs"
          aria-label={`${budget === null ? "Set" : "Edit"} budget for ${label}`}
          onClick={onEdit}
        >
          {budget === null ? "Set budget" : "Edit"}
        </Button>
      </div>
      {budget !== null ? (
        <div
          role="progressbar"
          aria-label={`${label} budget usage`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(Math.round((ratio ?? 0) * 100), 100)}
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min((ratio ?? 0) * 100, 100)}%`,
              backgroundColor: over ? "var(--color-destructive)" : color,
            }}
          />
        </div>
      ) : null}
      {over ? (
        <p className="text-xs text-destructive">
          Over budget by {formatMoney(spent - (budget ?? 0))}.
        </p>
      ) : null}
    </div>
  );
}

function SetBudgetDialog({
  month,
  target,
  onClose,
  onMutated,
}: {
  month: string;
  target: BudgetTarget | null;
  onClose: () => void;
  onMutated: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        {target ? (
          <SetBudgetForm
            key={target.categoryId ?? "overall"}
            month={month}
            target={target}
            onClose={onClose}
            onMutated={onMutated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SetBudgetForm({
  month,
  target,
  onClose,
  onMutated,
}: {
  month: string;
  target: BudgetTarget;
  onClose: () => void;
  onMutated: () => void;
}) {
  const [amount, setAmount] = useState(target.current > 0 ? String(target.current) : "");
  const [busy, setBusy] = useState(false);

  const save = async (amountMinor: number) => {
    setBusy(true);
    const result = await setBudgetAction({
      categoryId: target.categoryId,
      month,
      amountMinor,
    });
    setBusy(false);
    if (result.ok) {
      onClose();
      onMutated();
    } else {
      toast.error(result.error);
    }
  };

  const submit = async () => {
    const parsed = parseAmountInput(amount);
    if (parsed === null) {
      toast.error("Enter a valid amount (whole đồng).");
      return;
    }
    await save(parsed);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {target.label} — {formatMonthKey(month)}
        </DialogTitle>
        <DialogDescription>
          Monthly limit in đồng. Removing the budget clears the bar.
        </DialogDescription>
      </DialogHeader>
      <Input
        autoFocus
        inputMode="numeric"
        value={amount}
        onChange={(event) => setAmount(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") void submit();
        }}
        placeholder="5.000.000"
        aria-label="Budget amount"
      />
      <DialogFooter className="gap-2">
        {target.current > 0 ? (
          <Button
            variant="ghost"
            className="mr-auto text-destructive hover:text-destructive"
            onClick={() => void save(0)}
            disabled={busy}
          >
            Remove budget
          </Button>
        ) : null}
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !amount.trim()}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}
