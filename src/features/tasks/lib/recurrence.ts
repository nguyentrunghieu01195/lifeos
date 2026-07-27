import { addDays, addMonths, addWeeks, addYears } from "date-fns";

import type { RecurrenceFreq } from "../types";

/**
 * Todoist-style recurrence: completing a recurring task advances its due date
 * to the next occurrence instead of marking it done. The next occurrence is
 * always strictly in the future relative to `reference` (catching up across
 * multiple missed periods).
 */
export function nextOccurrence(
  current: Date,
  freq: RecurrenceFreq,
  interval: number,
  reference: Date = new Date(),
): Date {
  const step = (date: Date): Date => {
    switch (freq) {
      case "DAILY":
        return addDays(date, interval);
      case "WEEKLY":
        return addWeeks(date, interval);
      case "MONTHLY":
        return addMonths(date, interval);
      case "YEARLY":
        return addYears(date, interval);
    }
  };

  let next = step(current);
  // Guard against pathological loops while catching up long-overdue tasks.
  for (let i = 0; next <= reference && i < 1000; i++) {
    next = step(next);
  }
  return next;
}
