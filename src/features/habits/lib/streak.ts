/**
 * Pure streak and heatmap helpers.
 *
 * All inputs/outputs use "YYYY-MM-DD" date strings so the math stays
 * UTC-safe: only setUTCDate / getUTCDate is used internally — no local
 * timezone offsets can contaminate the results.
 */

export interface HeatmapCell {
  date: string;
  completed: boolean;
}

// ---------------------------------------------------------------------------
// Date arithmetic helpers (pure, UTC-only)
// ---------------------------------------------------------------------------

/** Add (or subtract) `n` calendar days to a "YYYY-MM-DD" string. */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function subtractDays(dateStr: string, n: number): string {
  return addDays(dateStr, -n);
}

/** Whole days between two "YYYY-MM-DD" strings (later − earlier). */
export function daysBetween(laterStr: string, earlierStr: string): number {
  const later = new Date(`${laterStr}T00:00:00Z`).getTime();
  const earlier = new Date(`${earlierStr}T00:00:00Z`).getTime();
  return Math.round((later - earlier) / 86_400_000);
}

/** Count completions in an inclusive date range. */
function countInRange(dateSet: Set<string>, startStr: string, endStr: string): number {
  let count = 0;
  for (let i = 0; i <= daysBetween(endStr, startStr); i++) {
    if (dateSet.has(addDays(startStr, i))) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Daily habit streaks
// ---------------------------------------------------------------------------

/**
 * Current daily streak ending at `today` (or yesterday when today is not
 * yet complete — grace for the day still being in progress).
 */
export function dailyStreak(completedDates: string[], today: string): number {
  const dateSet = new Set(completedDates);
  const startDate = dateSet.has(today) ? today : subtractDays(today, 1);
  let streak = 0;
  let current = startDate;
  while (dateSet.has(current)) {
    streak++;
    current = subtractDays(current, 1);
  }
  return streak;
}

/** Longest daily streak within the provided dates. */
export function bestDailyStreak(completedDates: string[]): number {
  if (completedDates.length === 0) return 0;
  const sorted = [...completedDates].sort();
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = daysBetween(sorted[i]!, sorted[i - 1]!);
    if (diff === 1) {
      current++;
      if (current > best) best = current;
    } else if (diff > 1) {
      current = 1;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Weekly habit streaks (rolling 7-day windows)
// ---------------------------------------------------------------------------

/**
 * Current weekly streak.
 *
 * Strategy: use rolling 7-day windows ending at `today`.
 * - Window 0 (current): [today-6..today] — counts if completions ≥ targetCount.
 *   If it does, include it; if not, start checking from window 1 (last week).
 * - Walk backwards until a window fails.
 */
export function weeklyStreak(completedDates: string[], targetCount: number, today: string): number {
  const dateSet = new Set(completedDates);
  const thisWeekCount = countInRange(dateSet, subtractDays(today, 6), today);
  const startOffset = thisWeekCount >= targetCount ? 0 : 1;

  let streak = 0;
  for (let offset = startOffset; offset < 104; offset++) {
    const weekEnd = subtractDays(today, offset * 7);
    const weekStart = subtractDays(weekEnd, 6);
    if (countInRange(dateSet, weekStart, weekEnd) >= targetCount) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

/** Longest weekly streak (in complete 7-day windows, scanning from earliest). */
export function bestWeeklyStreak(
  completedDates: string[],
  targetCount: number,
  today: string,
): number {
  if (completedDates.length === 0) return 0;
  const dateSet = new Set(completedDates);
  let best = 0;
  let current = 0;
  // Scan at most 520 weeks (10 years)
  for (let offset = 519; offset >= 0; offset--) {
    const weekEnd = subtractDays(today, offset * 7);
    const weekStart = subtractDays(weekEnd, 6);
    if (countInRange(dateSet, weekStart, weekEnd) >= targetCount) {
      current++;
      if (current > best) best = current;
    } else {
      current = 0;
    }
  }
  return best;
}

/** How many times a weekly habit was completed in the rolling 7 days ending today. */
export function thisWeekCount(completedDates: string[], today: string): number {
  const dateSet = new Set(completedDates);
  return countInRange(dateSet, subtractDays(today, 6), today);
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

/**
 * Trailing `days` cells ordered oldest → newest.
 * The caller renders these as a grid (53 columns × 7 rows for a year).
 */
export function buildHeatmap(completedDates: string[], today: string, days = 365): HeatmapCell[] {
  const dateSet = new Set(completedDates);
  const cells: HeatmapCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = subtractDays(today, i);
    cells.push({ date, completed: dateSet.has(date) });
  }
  return cells;
}

/** 14-day trailing cells for the mini heatmap on list cards. */
export function buildMiniHeatmap(completedDates: string[], today: string): HeatmapCell[] {
  return buildHeatmap(completedDates, today, 14);
}
