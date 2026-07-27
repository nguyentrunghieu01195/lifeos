/**
 * Pure health metric helpers — formatting, scoring, BMI.
 * No database calls; safe to import on the client.
 */

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export function formatKg(kg: number): string {
  return `${kg.toFixed(1)} kg`;
}

/** BMI category label from a kg / cm pair. */
export function bmiCategory(kg: number, heightCm: number): string {
  const bmi = kg / (heightCm / 100) ** 2;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25) return "Normal";
  if (bmi < 30) return "Overweight";
  return "Obese";
}

/** Weight delta: positive = gained, negative = lost. */
export function weightDelta(entries: { kg: number }[]): number | null {
  if (entries.length < 2) return null;
  return entries[entries.length - 1]!.kg - entries[0]!.kg;
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export function formatHours(hours: number): string {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/**
 * A blended sleep score (0–100) from duration and quality.
 * Based on a target of 8h optimal, scaled by the quality rating.
 */
export function sleepScore(hours: number, quality: number): number {
  const durationScore = Math.min(1, hours / 8) * 60;
  const qualityScore = (quality / 5) * 40;
  return Math.round(durationScore + qualityScore);
}

export function sleepQualityLabel(quality: number): string {
  switch (quality) {
    case 1:
      return "Poor";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Great";
    case 5:
      return "Excellent";
    default:
      return "—";
  }
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export const WATER_DAILY_TARGET = 8; // glasses (≈ 250 ml each)

export function waterProgressPercent(glasses: number): number {
  return Math.min(100, Math.round((glasses / WATER_DAILY_TARGET) * 100));
}

export function formatGlasses(glasses: number): string {
  return glasses === 1 ? "1 glass" : `${glasses} glasses`;
}

// ---------------------------------------------------------------------------
// Workout
// ---------------------------------------------------------------------------

export type WorkoutTypeKey = "CARDIO" | "STRENGTH" | "FLEXIBILITY" | "OTHER";

export const WORKOUT_TYPE_LABELS: Record<WorkoutTypeKey, string> = {
  CARDIO: "Cardio",
  STRENGTH: "Strength",
  FLEXIBILITY: "Flexibility",
  OTHER: "Other",
};

export const WORKOUT_TYPE_ICONS: Record<WorkoutTypeKey, string> = {
  CARDIO: "🏃",
  STRENGTH: "🏋️",
  FLEXIBILITY: "🧘",
  OTHER: "⚡",
};

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Total duration and session count from a list of workouts. */
export function workoutSummary(entries: { durationMinutes: number }[]): {
  sessions: number;
  totalMinutes: number;
} {
  return {
    sessions: entries.length,
    totalMinutes: entries.reduce((acc, entry) => acc + entry.durationMinutes, 0),
  };
}

// ---------------------------------------------------------------------------
// General date helpers
// ---------------------------------------------------------------------------

export function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export function dateStringToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

export function utcToDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Subtract n days from a YYYY-MM-DD string, returns YYYY-MM-DD. */
export function subtractDaysFromDate(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
