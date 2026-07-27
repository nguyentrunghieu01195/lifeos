import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const CALENDAR_VIEWS = ["month", "week", "day", "agenda"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export interface DateRange {
  from: Date;
  to: Date;
}

const WEEK_OPTS = { weekStartsOn: 1 as const };

/** Visible (and fetched) range for each calendar view. */
export function computeRange(view: CalendarView, cursor: Date): DateRange {
  switch (view) {
    case "month":
      return {
        from: startOfWeek(startOfMonth(cursor), WEEK_OPTS),
        to: endOfWeek(endOfMonth(cursor), WEEK_OPTS),
      };
    case "week":
      return { from: startOfWeek(cursor, WEEK_OPTS), to: endOfWeek(cursor, WEEK_OPTS) };
    case "day":
      return { from: startOfDay(cursor), to: endOfDay(cursor) };
    case "agenda":
      return { from: startOfDay(cursor), to: endOfDay(addDays(cursor, 29)) };
  }
}

/** Step the cursor when navigating prev/next for a view. */
export function stepCursor(view: CalendarView, cursor: Date, direction: 1 | -1): Date {
  switch (view) {
    case "month": {
      const next = new Date(cursor);
      next.setMonth(next.getMonth() + direction);
      return next;
    }
    case "week":
      return addDays(cursor, 7 * direction);
    case "day":
      return addDays(cursor, direction);
    case "agenda":
      return addDays(cursor, 30 * direction);
  }
}
