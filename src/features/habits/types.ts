export type { ActionResult } from "@/types/actions";
export type { HeatmapCell } from "./lib/streak";

export type HabitFrequencyDto = "DAILY" | "WEEKLY";

export interface HabitDto {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequencyDto;
  targetCount: number;
  isActive: boolean;
  createdAt: string;
}

/** Habit list item: includes live stats for today and the list view. */
export interface HabitWithStatsDto extends HabitDto {
  /** Whether the habit was completed today. */
  completedToday: boolean;
  /** Current consecutive streak (days or weeks). */
  streak: number;
  /** Dates completed in the last 14 days (for the mini heatmap). */
  recentDates: string[];
}

/** Full detail with 365-day heatmap data. */
export interface HabitDetailDto extends HabitWithStatsDto {
  /** Best streak ever recorded. */
  bestStreak: number;
  /** Total number of completions. */
  totalCompletions: number;
  /** All completion date strings for the heatmap. */
  allDates: string[];
}

/** An AI-suggested habit the user picks from before it is created. */
export interface HabitSuggestionDto {
  name: string;
  icon: string;
  frequency: HabitFrequencyDto;
  targetCount: number;
  reason: string;
}
