"use client";

import { Dumbbell, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  formatDuration,
  WORKOUT_TYPE_ICONS,
  WORKOUT_TYPE_LABELS,
  workoutSummary,
  type WorkoutTypeKey,
} from "../lib/metrics";
import { deleteHealthLogAction, logWorkoutAction } from "../server/actions";
import type { WorkoutLogDto } from "../types";

interface WorkoutTabProps {
  today: string;
  todayWorkouts: WorkoutLogDto[];
  recentWorkouts: WorkoutLogDto[];
  onMutated: () => void;
}

export function WorkoutTabContent({
  today,
  todayWorkouts,
  recentWorkouts,
  onMutated,
}: WorkoutTabProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState<WorkoutTypeKey>("CARDIO");
  const [duration, setDuration] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const mins = parseInt(duration, 10);
    if (!name.trim() || isNaN(mins) || mins < 1) {
      toast.error("Enter a name and duration.");
      return;
    }
    setSaving(true);
    const result = await logWorkoutAction({
      date: today,
      name: name.trim(),
      workoutType: type,
      durationMinutes: mins,
    });
    setSaving(false);
    if (result.ok) {
      setName("");
      setDuration("");
      onMutated();
    } else {
      toast.error(result.error);
    }
  };

  const summary = workoutSummary(todayWorkouts);
  const allSummary = workoutSummary(recentWorkouts);

  return (
    <div className="space-y-4">
      <Card className="glass">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Log a workout</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <div className="min-w-40 flex-1 space-y-1">
              <Label htmlFor="workout-name">Exercise</Label>
              <Input
                id="workout-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
                placeholder="e.g. Running"
                maxLength={80}
                aria-label="Workout exercise name"
              />
            </div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={type} onValueChange={(value: WorkoutTypeKey) => setType(value)}>
                <SelectTrigger className="w-36" aria-label="Workout type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(WORKOUT_TYPE_LABELS) as WorkoutTypeKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      {WORKOUT_TYPE_ICONS[key]} {WORKOUT_TYPE_LABELS[key]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="workout-duration">Duration (min)</Label>
              <Input
                id="workout-duration"
                type="number"
                min={1}
                max={600}
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void save()}
                placeholder="30"
                className="w-24"
                aria-label="Workout duration in minutes"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={() => void save()} disabled={saving || !name.trim() || !duration}>
                {saving ? (
                  <Loader2 aria-hidden className="animate-spin" />
                ) : (
                  <Dumbbell aria-hidden />
                )}
                Log
              </Button>
            </div>
          </div>

          {todayWorkouts.length > 0 ? (
            <div className="space-y-1.5 pt-1">
              <p className="text-xs text-muted-foreground">
                Today: {summary.sessions} session{summary.sessions !== 1 ? "s" : ""},{" "}
                {formatDuration(summary.totalMinutes)}
              </p>
              <ul className="space-y-1">
                {todayWorkouts.map((workout) => (
                  <li key={workout.id} className="flex items-center gap-2 text-sm">
                    <span>{WORKOUT_TYPE_ICONS[workout.workoutType as WorkoutTypeKey]}</span>
                    <span className="truncate">{workout.name}</span>
                    <span className="text-muted-foreground tabular-nums">
                      {formatDuration(workout.durationMinutes)}
                    </span>
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground hover:text-destructive"
                      onClick={async () => {
                        const result = await deleteHealthLogAction("workout", workout.id);
                        if (result.ok) onMutated();
                        else toast.error(result.error);
                      }}
                      aria-label={`Delete workout ${workout.name}`}
                    >
                      <Trash2 aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="glass">
        <CardHeader>
          <CardTitle className="text-base">Recent workouts</CardTitle>
        </CardHeader>
        <CardContent>
          {recentWorkouts.length === 0 ? (
            <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Dumbbell aria-hidden className="size-4" />
              No workouts logged yet.
            </p>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                {allSummary.sessions} sessions · {formatDuration(allSummary.totalMinutes)} total
              </p>
              <ul className="divide-y">
                {recentWorkouts.map((workout) => (
                  <li key={workout.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="text-base">
                      {WORKOUT_TYPE_ICONS[workout.workoutType as WorkoutTypeKey]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{workout.name}</p>
                      <p className="text-xs text-muted-foreground">{workout.date}</p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {formatDuration(workout.durationMinutes)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
