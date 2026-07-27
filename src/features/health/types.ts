export type { ActionResult } from "@/types/actions";
import type { WorkoutTypeKey } from "./lib/metrics";
export type { WorkoutTypeKey };

export interface WeightLogDto {
  id: string;
  date: string;
  kg: number;
  notes: string;
}

export interface SleepLogDto {
  id: string;
  date: string;
  hours: number;
  quality: number;
  notes: string;
}

export interface WaterLogDto {
  id: string;
  date: string;
  glasses: number;
  notes: string;
}

export interface WorkoutLogDto {
  id: string;
  date: string;
  name: string;
  workoutType: WorkoutTypeKey;
  durationMinutes: number;
  notes: string;
}

/** Everything the /health page needs. */
export interface HealthSnapshot {
  today: string;
  todayWeight: WeightLogDto | null;
  todaySleep: SleepLogDto | null;
  todayWater: WaterLogDto | null;
  todayWorkouts: WorkoutLogDto[];
  weightTrend: WeightLogDto[];
  sleepTrend: SleepLogDto[];
  waterTrend: WaterLogDto[];
  recentWorkouts: WorkoutLogDto[];
}

/** Dashboard widget data. */
export interface TodayHealthDto {
  today: string;
  weight: number | null;
  sleepHours: number | null;
  sleepQuality: number | null;
  waterGlasses: number;
  workoutsThisWeek: number;
  workoutMinutesThisWeek: number;
}
