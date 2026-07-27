"use client";

import { Brain, Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useHealth, useInvalidateHealth } from "../hooks";
import { analyzeHealthAction } from "../server/actions";
import type { HealthSnapshot } from "../types";
import { SleepTabContent } from "./sleep-tab";
import { WaterTabContent } from "./water-tab";
import { WeightTabContent } from "./weight-tab";
import { WorkoutTabContent } from "./workout-tab";

const TABS = ["weight", "sleep", "water", "workout"] as const;
type TabId = (typeof TABS)[number];

interface HealthViewProps {
  initial: HealthSnapshot;
}

export function HealthView({ initial }: HealthViewProps) {
  const searchParams = useSearchParams();
  const invalidate = useInvalidateHealth();
  const [aiOpen, setAiOpen] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const { data } = useHealth(initial);

  const requestedTab = searchParams.get("tab");
  const tab: TabId = (TABS as readonly string[]).includes(requestedTab ?? "")
    ? (requestedTab as TabId)
    : "weight";

  const runAnalysis = async () => {
    setAiBusy(true);
    setAnalysis(null);
    const result = await analyzeHealthAction();
    setAiBusy(false);
    if (result.ok) {
      setAnalysis(result.data.analysis);
      setAiOpen(true);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs defaultValue={tab}>
          <TabsList>
            <TabsTrigger
              value="weight"
              onClick={() => history.replaceState(null, "", "?tab=weight")}
            >
              ⚖️ Weight
            </TabsTrigger>
            <TabsTrigger value="sleep" onClick={() => history.replaceState(null, "", "?tab=sleep")}>
              💤 Sleep
            </TabsTrigger>
            <TabsTrigger value="water" onClick={() => history.replaceState(null, "", "?tab=water")}>
              💧 Water
            </TabsTrigger>
            <TabsTrigger
              value="workout"
              onClick={() => history.replaceState(null, "", "?tab=workout")}
            >
              🏋️ Workout
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => void runAnalysis()}
          disabled={aiBusy}
        >
          {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : <Brain aria-hidden />}
          AI Analyse
        </Button>
      </div>

      {tab === "weight" && (
        <WeightTabContent
          today={data.today}
          todayLog={data.todayWeight}
          trend={data.weightTrend}
          onMutated={invalidate}
        />
      )}
      {tab === "sleep" && (
        <SleepTabContent
          today={data.today}
          todayLog={data.todaySleep}
          trend={data.sleepTrend}
          onMutated={invalidate}
        />
      )}
      {tab === "water" && (
        <WaterTabContent
          today={data.today}
          todayLog={data.todayWater}
          trend={data.waterTrend}
          onMutated={invalidate}
        />
      )}
      {tab === "workout" && (
        <WorkoutTabContent
          today={data.today}
          todayWorkouts={data.todayWorkouts}
          recentWorkouts={data.recentWorkouts}
          onMutated={invalidate}
        />
      )}

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Health analysis</DialogTitle>
            <DialogDescription>Based on your recent health data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            {analysis
              ?.split("\n")
              .filter((line) => line.trim())
              .map((line, index) => (
                <p key={index} className="text-sm leading-relaxed">
                  {line}
                </p>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
