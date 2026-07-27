import { z } from "zod";

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color.");

export const createHabitSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(60),
  icon: z.string().trim().min(1).max(8).default("✅"),
  color: hexColor.default("#6366f1"),
  frequency: z.enum(["DAILY", "WEEKLY"]).default("DAILY"),
  targetCount: z.number().int().min(1).max(7).default(3),
});

export const updateHabitSchema = z.object({
  id: z.string().cuid(),
  name: z.string().trim().min(1).max(60).optional(),
  icon: z.string().trim().min(1).max(8).optional(),
  color: hexColor.optional(),
  frequency: z.enum(["DAILY", "WEEKLY"]).optional(),
  targetCount: z.number().int().min(1).max(7).optional(),
});

/** Toggle a check-in for a given habit on a given day. */
export const toggleCheckInSchema = z.object({
  habitId: z.string().cuid(),
  /** "YYYY-MM-DD" — the day to toggle. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
});

export const aiSuggestHabitsSchema = z.object({
  goal: z.string().trim().min(5, "Describe your goal in at least a few words.").max(300),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;
export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;
