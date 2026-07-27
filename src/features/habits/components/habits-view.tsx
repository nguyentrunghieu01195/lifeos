"use client";

import { Flame, Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import type { HabitWithStatsDto } from "../types";
import { HabitCard } from "./habit-card";
import { HabitFormDialog } from "./habit-form-dialog";

interface HabitsViewProps {
  today: string;
  habits: HabitWithStatsDto[];
}

export function HabitsView({ today, habits }: HabitsViewProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<HabitWithStatsDto | null>(null);

  const doneCount = habits.filter((habit) => habit.completedToday).length;

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (habit: HabitWithStatsDto) => {
    setEditing(habit);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {habits.length > 0 ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{doneCount}</span>
              {" of "}
              <span className="font-semibold text-foreground tabular-nums">{habits.length}</span>
              {" today"}
            </span>
            {doneCount > 0 ? (
              <span aria-hidden className="text-amber-500">
                <Flame className="inline size-4" />
              </span>
            ) : null}
          </div>
        ) : null}
        <Button className="ml-auto" onClick={openNew}>
          <Plus aria-hidden />
          New habit
        </Button>
      </div>

      {habits.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <Flame aria-hidden className="size-6" />
          No habits yet — start building your first streak.
        </div>
      ) : (
        <div className="space-y-2">
          {habits.map((habit) => (
            <HabitCard key={habit.id} habit={habit} today={today} onEdit={openEdit} />
          ))}
        </div>
      )}

      <HabitFormDialog open={dialogOpen} editing={editing} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
