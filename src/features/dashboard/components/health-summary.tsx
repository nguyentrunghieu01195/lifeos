import { ArrowRight, HeartPulse } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatDuration,
  formatGlasses,
  formatHours,
  formatKg,
  waterProgressPercent,
} from "@/features/health/lib/metrics";
import type { TodayHealthDto } from "@/features/health/types";

/** Dashboard widget: today's health snapshot. */
export function HealthSummaryCard({ data }: { data: TodayHealthDto }) {
  const empty =
    data.weight === null &&
    data.sleepHours === null &&
    data.waterGlasses === 0 &&
    data.workoutsThisWeek === 0;
  const waterPct = waterProgressPercent(data.waterGlasses);

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HeartPulse aria-hidden className="size-4 text-rose-500" />
          Today&apos;s health
        </CardTitle>
        <CardDescription>
          {empty ? "No health data yet." : "Your snapshot for the day."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <HeartPulse aria-hidden className="size-4" />
            Start tracking to see your data here.
          </p>
        ) : (
          <dl className="space-y-1.5 text-sm">
            {data.weight !== null ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">⚖️ Weight</dt>
                <dd className="font-mono tabular-nums">{formatKg(data.weight)}</dd>
              </div>
            ) : null}
            {data.sleepHours !== null ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">💤 Sleep</dt>
                <dd className="font-mono tabular-nums">
                  {formatHours(data.sleepHours)}
                  {data.sleepQuality !== null ? ` · ${data.sleepQuality}/5` : ""}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">💧 Water</dt>
              <dd className="flex items-center gap-1.5 font-mono tabular-nums">
                {formatGlasses(data.waterGlasses)}
                <span className="h-1.5 w-12 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${waterPct}%`,
                      backgroundColor: waterPct >= 100 ? "#10b981" : "#0ea5e9",
                    }}
                  />
                </span>
              </dd>
            </div>
            {data.workoutsThisWeek > 0 ? (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">🏋️ This week</dt>
                <dd className="font-mono tabular-nums">
                  {data.workoutsThisWeek} sessions · {formatDuration(data.workoutMinutesThisWeek)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/health">
            Open health
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
