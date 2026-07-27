"use client";

import { Droplets, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { formatGlasses, WATER_DAILY_TARGET, waterProgressPercent } from "../lib/metrics";
import { deleteHealthLogAction, logWaterAction } from "../server/actions";
import type { WaterLogDto } from "../types";
import { WaterChart } from "./health-charts";

interface WaterTabProps {
  today: string;
  todayLog: WaterLogDto | null;
  trend: WaterLogDto[];
  onMutated: () => void;
}

export function WaterTabContent({ today, todayLog, trend, onMutated }: WaterTabProps) {
  const [glasses, setGlasses] = useState(todayLog?.glasses ?? 0);
  const [syncing, setSyncing] = useState(false);

  const syncGlasses = async (next: number) => {
    setSyncing(true);
    const result = await logWaterAction({ date: today, glasses: next });
    setSyncing(false);
    if (!result.ok) {
      setGlasses(todayLog?.glasses ?? 0);
      toast.error(result.error);
    } else {
      onMutated();
    }
  };

  const add = () => {
    const next = glasses + 1;
    setGlasses(next);
    void syncGlasses(next);
  };

  const remove = () => {
    if (glasses <= 0) return;
    const next = glasses - 1;
    setGlasses(next);
    if (next === 0 && todayLog) {
      void deleteHealthLogAction("water", todayLog.id).then((result) => {
        if (!result.ok) {
          setGlasses(glasses);
          toast.error(result.error);
        } else {
          onMutated();
        }
      });
    } else {
      void syncGlasses(next);
    }
  };

  const percent = waterProgressPercent(glasses);
  const done = glasses >= WATER_DAILY_TARGET;

  return (
    <div className="space-y-4">
      <Card className={cn("glass transition-colors", done && "border-emerald-500/40")}>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <div className="relative flex size-32 items-center justify-center">
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90">
              <circle cx={50} cy={50} r={42} className="fill-none stroke-muted" strokeWidth={8} />
              <circle
                cx={50}
                cy={50}
                r={42}
                className="fill-none"
                stroke={done ? "#10b981" : "#0ea5e9"}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - percent / 100)}`}
                style={{ transition: "stroke-dashoffset 0.4s ease" }}
              />
            </svg>
            <div className="z-10 flex flex-col items-center">
              <span className="text-3xl font-bold tabular-nums" aria-live="polite">
                {glasses}
              </span>
              <span className="text-xs text-muted-foreground">/ {WATER_DAILY_TARGET}</span>
            </div>
          </div>

          <p
            className={cn(
              "text-sm font-medium",
              done ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {done ? "Goal reached! 🎉" : `${WATER_DAILY_TARGET - glasses} more to goal`}
          </p>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              onClick={remove}
              disabled={glasses === 0 || syncing}
              aria-label="Remove a glass of water"
            >
              <Minus aria-hidden />
            </Button>
            <Button
              size="icon"
              className="size-12 rounded-full"
              onClick={add}
              disabled={syncing}
              aria-label="Add a glass of water"
            >
              <Droplets aria-hidden className="size-5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-10 rounded-full"
              onClick={add}
              disabled={syncing}
              aria-label="Add a glass of water"
            >
              <Plus aria-hidden />
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            {formatGlasses(glasses)} today (1 glass ≈ 250 ml)
          </p>
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">7-day history</CardTitle>
        </CardHeader>
        <CardContent>
          <WaterChart data={trend} />
        </CardContent>
      </Card>
    </div>
  );
}
