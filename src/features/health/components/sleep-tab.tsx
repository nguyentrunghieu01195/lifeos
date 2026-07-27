"use client";

import { Moon, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { formatHours, sleepQualityLabel } from "../lib/metrics";
import { deleteHealthLogAction, logSleepAction } from "../server/actions";
import type { SleepLogDto } from "../types";
import { SleepChart } from "./health-charts";

interface SleepTabProps {
  today: string;
  todayLog: SleepLogDto | null;
  trend: SleepLogDto[];
  onMutated: () => void;
}

export function SleepTabContent({ today, todayLog, trend, onMutated }: SleepTabProps) {
  const [hours, setHours] = useState(todayLog ? String(todayLog.hours) : "");
  const [quality, setQuality] = useState(todayLog?.quality ?? 3);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const h = parseFloat(hours);
    if (isNaN(h) || h < 0.5 || h > 24) {
      toast.error("Enter a valid duration (0.5–24 hours).");
      return;
    }
    setSaving(true);
    const result = await logSleepAction({ date: today, hours: Math.round(h * 2) / 2, quality });
    setSaving(false);
    if (result.ok) onMutated();
    else toast.error(result.error);
  };

  const avgHours =
    trend.length > 0 ? trend.reduce((acc, s) => acc + s.hours, 0) / trend.length : null;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1 glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Last night&apos;s sleep</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Moon aria-hidden className="size-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.5"
                min={0.5}
                max={24}
                value={hours}
                onChange={(event) => setHours(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
                placeholder="e.g. 7.5"
                aria-label="Sleep duration in hours"
                className="w-24"
              />
              <Label className="text-muted-foreground">hrs</Label>
            </div>
            <div className="space-y-1">
              <Label>Quality</Label>
              <div className="flex gap-1" role="group" aria-label="Sleep quality">
                {[1, 2, 3, 4, 5].map((q) => (
                  <button
                    key={q}
                    type="button"
                    aria-label={`Quality ${q}: ${sleepQualityLabel(q)}`}
                    aria-pressed={quality === q}
                    onClick={() => setQuality(q)}
                    className={cn(
                      "rounded-lg border px-3 py-1 text-sm transition-colors",
                      quality === q
                        ? "border-primary bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {q}
                  </button>
                ))}
                <span className="ml-2 self-center text-sm text-muted-foreground">
                  {sleepQualityLabel(quality)}
                </span>
              </div>
            </div>
            <Button onClick={() => void save()} disabled={saving || !hours.trim()} size="sm">
              {todayLog ? "Update" : "Log"}
            </Button>
            {todayLog ? (
              <p className="text-xs text-muted-foreground">
                Logged: {formatHours(todayLog.hours)}, quality {todayLog.quality}/5{" "}
                <button
                  type="button"
                  className="ml-1 text-destructive hover:underline"
                  onClick={async () => {
                    const result = await deleteHealthLogAction("sleep", todayLog.id);
                    if (result.ok) {
                      setHours("");
                      onMutated();
                    } else toast.error(result.error);
                  }}
                  aria-label="Delete today's sleep log"
                >
                  <Trash2 aria-hidden className="inline size-3" />
                </button>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {avgHours !== null ? (
          <Card className="flex-1 glass">
            <CardContent className="flex flex-col items-center justify-center gap-1 py-6">
              <p className="text-2xl font-bold tabular-nums">{formatHours(avgHours)}</p>
              <p className="text-xs text-muted-foreground">Avg last 14 nights</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">
            14-day trend (bar height = hours, opacity = quality)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <SleepChart data={trend} />
        </CardContent>
      </Card>
    </div>
  );
}
