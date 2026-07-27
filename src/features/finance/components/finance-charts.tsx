"use client";

import { Bar, BarChart, Cell, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { formatMoney, formatMoneyCompact } from "../lib/money";
import type { CategorySpendDto, TrendPoint } from "../types";

/** Donut of this month's expenses by category. */
export function CategoryDonut({ data }: { data: CategorySpendDto[] }) {
  const config: ChartConfig = Object.fromEntries(
    data.map((entry) => [entry.categoryId ?? "uncategorized", { label: entry.name }]),
  );

  return (
    <ChartContainer config={config} className="mx-auto aspect-square max-h-64 w-full">
      <PieChart>
        <ChartTooltip
          content={
            <ChartTooltipContent
              nameKey="name"
              formatter={(value, name) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground">{name}</span>
                  <span className="font-mono font-medium tabular-nums">
                    {formatMoney(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Pie
          data={data}
          dataKey="total"
          nameKey="name"
          innerRadius="55%"
          outerRadius="85%"
          strokeWidth={2}
          stroke="var(--color-background)"
        >
          {data.map((entry) => (
            <Cell key={entry.categoryId ?? "uncategorized"} fill={entry.color} />
          ))}
        </Pie>
      </PieChart>
    </ChartContainer>
  );
}

const trendConfig = {
  income: { label: "Income", color: "var(--chart-3)" },
  expense: { label: "Expense", color: "var(--chart-5)" },
} satisfies ChartConfig;

/** Income vs expense over the trailing months. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ChartContainer config={trendConfig} className="h-64 w-full">
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <XAxis
          dataKey="month"
          tickLine={false}
          axisLine={false}
          tickFormatter={(month: string) => month.slice(5)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={58}
          tickFormatter={(value: number) => formatMoneyCompact(value)}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => (
                <div className="flex w-full items-center justify-between gap-3">
                  <span className="text-muted-foreground capitalize">{String(name)}</span>
                  <span
                    className="font-mono font-medium tabular-nums"
                    style={{ color: item.color }}
                  >
                    {formatMoney(Number(value))}
                  </span>
                </div>
              )}
            />
          }
        />
        <Bar dataKey="income" fill="var(--color-income)" radius={[4, 4, 0, 0]} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
