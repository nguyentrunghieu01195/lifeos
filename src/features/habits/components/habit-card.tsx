"use client";

import { CheckCircle2, Circle, Flame, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { archiveHabitAction, toggleCheckInAction } from "../server/actions";
import type { HabitDetailDto, HabitWithStatsDto } from "../types";
import { HabitHeatmap, MiniHeatmap } from "./habit-heatmap";

interface HabitCardProps {
  habit: HabitWithStatsDto;
  today: string;
  onEdit: (habit: HabitWithStatsDto) => void;
}

export function HabitCard({ habit, today, onEdit }: HabitCardProps) {
  const router = useRouter();
  const [done, setDone] = useState(habit.completedToday);
  const [toggling, setToggling] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [archiveArmed, setArchiveArmed] = useState(false);
  const armTimer = useState<ReturnType<typeof setTimeout> | null>(null);

  const toggle = async () => {
    if (toggling) return;
    const next = !done;
    setDone(next);
    setToggling(true);
    const result = await toggleCheckInAction({ habitId: habit.id, date: today });
    setToggling(false);
    if (!result.ok) {
      setDone(!next);
      toast.error(result.error);
    } else {
      router.refresh();
    }
  };

  const archive = async () => {
    if (!archiveArmed) {
      setArchiveArmed(true);
      if (armTimer[0]) clearTimeout(armTimer[0]);
      armTimer[1](setTimeout(() => setArchiveArmed(false), 3000));
      return;
    }
    const result = await archiveHabitAction(habit.id);
    if (!result.ok) toast.error(result.error);
    // revalidatePath from action will refresh via router
  };

  const frequencyLabel = habit.frequency === "DAILY" ? "Daily" : `${habit.targetCount}×/week`;

  return (
    <>
      <Card className="glass transition-shadow hover:shadow-md">
        <CardContent className="space-y-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={`${done ? "Uncheck" : "Check"} ${habit.name}`}
              aria-pressed={done}
              disabled={toggling}
              onClick={() => void toggle()}
              className={cn(
                "shrink-0 transition-transform active:scale-95",
                toggling && "opacity-60",
              )}
            >
              {done ? (
                <CheckCircle2
                  aria-hidden
                  className="size-7 text-emerald-500"
                  style={{ color: habit.color }}
                />
              ) : (
                <Circle aria-hidden className="size-7 text-muted-foreground" />
              )}
            </button>

            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => setDetailOpen(true)}
              aria-label={`View details for ${habit.name}`}
            >
              <span className="text-sm font-semibold">
                {habit.icon} {habit.name}
              </span>
            </button>

            {habit.streak > 0 ? (
              <span
                className="flex shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums"
                aria-label={`${habit.streak} day streak`}
                style={{ color: habit.color }}
              >
                <Flame aria-hidden className="size-3.5" />
                {habit.streak}
              </span>
            ) : null}

            <Badge
              variant="outline"
              className="hidden text-[10px] font-normal text-muted-foreground sm:flex"
            >
              {frequencyLabel}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={`Options for ${habit.name}`}
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => setDetailOpen(true)}>
                  View heatmap
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onEdit(habit)}>
                  <Pencil aria-hidden />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => void archive()}
                  aria-label={archiveArmed ? "Confirm archive" : `Archive ${habit.name}`}
                >
                  <Trash2 aria-hidden />
                  {archiveArmed ? "Confirm archive" : "Archive"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <MiniHeatmap completedDates={habit.recentDates} today={today} color={habit.color} />
        </CardContent>
      </Card>

      <HabitDetailDialog
        habitId={habit.id}
        name={`${habit.icon} ${habit.name}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />
    </>
  );
}

function HabitDetailDialog({
  habitId,
  name,
  open,
  onClose,
}: {
  habitId: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<HabitDetailDto | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (detail || loading) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/habits/${habitId}`);
      if (response.ok) {
        const data = (await response.json()) as HabitDetailDto;
        setDetail(data);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) void load();
        else onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          {detail ? (
            <DialogDescription>
              🔥 {detail.streak} current · 🏆 {detail.bestStreak} best · {detail.totalCompletions}{" "}
              total
            </DialogDescription>
          ) : null}
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : detail ? (
          <div className="overflow-x-auto">
            <HabitHeatmap
              completedDates={detail.allDates}
              today={new Date().toISOString().slice(0, 10)}
              color={detail.color}
            />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>1 year ago</span>
              <span>Today</span>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
