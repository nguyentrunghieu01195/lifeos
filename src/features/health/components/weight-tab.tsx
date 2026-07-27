"use client";

import { Scale, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { formatKg, weightDelta } from "../lib/metrics";
import { logWeightAction, deleteHealthLogAction } from "../server/actions";
import type { WeightLogDto } from "../types";
import { WeightChart } from "./health-charts";

interface WeightTabProps {
  today: string;
  todayLog: WeightLogDto | null;
  trend: WeightLogDto[];
  onMutated: () => void;
}

export function WeightTabContent({ today, todayLog, trend, onMutated }: WeightTabProps) {
  const [kg, setKg] = useState(todayLog ? String(todayLog.kg) : "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const value = parseFloat(kg);
    if (isNaN(value) || value < 20 || value > 500) {
      toast.error("Enter a valid weight (20–500 kg).");
      return;
    }
    setSaving(true);
    const result = await logWeightAction({ date: today, kg: Math.round(value * 10) / 10 });
    setSaving(false);
    if (result.ok) onMutated();
    else toast.error(result.error);
  };

  const delta = weightDelta(trend);

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1 glass">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Today&apos;s weight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Scale aria-hidden className="size-4 text-muted-foreground" />
              <Input
                type="number"
                step="0.1"
                min={20}
                max={500}
                value={kg}
                onChange={(event) => setKg(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
                placeholder="e.g. 68.5"
                aria-label="Weight in kg"
                className="w-32"
              />
              <Label className="shrink-0 text-muted-foreground">kg</Label>
              <Button onClick={() => void save()} disabled={saving || !kg.trim()} size="sm">
                {todayLog ? "Update" : "Log"}
              </Button>
            </div>
            {todayLog ? (
              <p className="text-xs text-muted-foreground">
                Logged: {formatKg(todayLog.kg)}{" "}
                <button
                  type="button"
                  className="ml-1 text-destructive underline-offset-2 hover:underline"
                  onClick={async () => {
                    const result = await deleteHealthLogAction("weight", todayLog.id);
                    if (result.ok) {
                      setKg("");
                      onMutated();
                    } else toast.error(result.error);
                  }}
                  aria-label="Delete today's weight log"
                >
                  <Trash2 aria-hidden className="inline size-3" />
                </button>
              </p>
            ) : null}
          </CardContent>
        </Card>

        {trend.length > 0 ? (
          <Card className="flex-1 glass">
            <CardContent className="flex flex-col items-center justify-center gap-1 py-6">
              <p className="text-2xl font-bold tabular-nums">{formatKg(trend.at(-1)!.kg)}</p>
              <p className="text-xs text-muted-foreground">Latest</p>
              {delta !== null ? (
                <p
                  className={cn(
                    "text-sm font-medium tabular-nums",
                    delta < 0 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive",
                  )}
                >
                  {delta >= 0 ? "+" : ""}
                  {delta.toFixed(1)} kg (30 days)
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">30-day trend</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightChart data={trend} />
        </CardContent>
      </Card>
    </div>
  );
}
