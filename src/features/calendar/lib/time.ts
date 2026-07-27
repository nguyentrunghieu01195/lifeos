import { differenceInMinutes, startOfDay } from "date-fns";

const MINUTES_PER_DAY = 24 * 60;

/**
 * Vertical placement of a timed event inside a day column (percentages of the
 * 24h track). Events spilling over midnight are clamped to the visible day.
 */
export function eventBlockPosition(
  start: Date,
  end: Date,
  day: Date,
): { topPct: number; heightPct: number } {
  const dayStart = startOfDay(day);
  const startMin = Math.max(0, differenceInMinutes(start, dayStart));
  const endMin = Math.min(
    MINUTES_PER_DAY,
    Math.max(startMin + 15, differenceInMinutes(end, dayStart)),
  );

  const clampedStart = Math.min(startMin, MINUTES_PER_DAY - 15);
  return {
    topPct: (clampedStart / MINUTES_PER_DAY) * 100,
    heightPct: ((endMin - clampedStart) / MINUTES_PER_DAY) * 100,
  };
}

/**
 * Build a UTC instant from a local wall-clock date/time in the viewer's
 * timezone. `tzOffsetMinutes` follows JS getTimezoneOffset(): UTC − local.
 */
export function dateFromLocalParts(
  dateStr: string,
  timeStr: string,
  tzOffsetMinutes: number,
): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hours, minutes] = timeStr.split(":").map(Number);
  const utcMs =
    Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0) +
    tzOffsetMinutes * 60_000;
  return new Date(utcMs);
}
