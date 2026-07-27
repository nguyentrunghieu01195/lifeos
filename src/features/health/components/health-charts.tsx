"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { WATER_DAILY_TARGET } from "../lib/metrics";
import type { SleepLogDto, WaterLogDto, WeightLogDto } from "../types";

const weightConfig = {
  kg: { label: "Weight (kg)", color: "var(--chart-1)" },
} satisfies ChartConfig;

export function WeightChart({ data }: { data: WeightLogDto[] }) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Log at least 2 days of weight to see a trend.
      </p>
    );
  }

  const min = Math.floor(Math.min(...data.map((d) => d.kg)) - 1);
  const max = Math.ceil(Math.max(...data.map((d) => d.kg)) + 1);

  return (
    <ChartContainer config={weightConfig} className="h-56 w-full">
      <LineChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={(date: string) => date.slice(5)}
        />
        <YAxis tickLine={false} axisLine={false} domain={[min, max]} width={42} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Line
          dataKey="kg"
          type="monotone"
          stroke="var(--color-kg)"
          strokeWidth={2}
          dot={{ r: 3, strokeWidth: 0, fill: "var(--color-kg)" }}
        />
      </LineChart>
    </ChartContainer>
  );
}

const sleepConfig = {
  hours: { label: "Hours", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function SleepChart({ data }: { data: SleepLogDto[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No sleep data yet.</p>;
  }

  return (
    <ChartContainer config={sleepConfig} className="h-56 w-full">
      <ComposedChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={(date: string) => date.slice(5)}
        />
        <YAxis tickLine={false} axisLine={false} domain={[0, 12]} width={32} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name) => (
                <span>{name === "hours" ? `${value}h` : `${value}/5`}</span>
              )}
            />
          }
        />
        <Bar dataKey="hours" fill="var(--color-hours)" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={`oklch(0.65 0.15 210 / ${0.4 + (entry.quality / 5) * 0.6})`} />
          ))}
        </Bar>
      </ComposedChart>
    </ChartContainer>
  );
}

const waterConfig = {
  glasses: { label: "Glasses", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function WaterChart({ data }: { data: WaterLogDto[] }) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No water data yet.</p>;
  }

  return (
    <ChartContainer config={waterConfig} className="h-44 w-full">
      <BarChart data={data} margin={{ left: 8, right: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickFormatter={(date: string) => date.slice(5)}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          domain={[0, Math.max(WATER_DAILY_TARGET + 2, 10)]}
          width={28}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="glasses" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={index}
              fill={
                entry.glasses >= WATER_DAILY_TARGET
                  ? "var(--color-chart-3)"
                  : "var(--color-glasses)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
