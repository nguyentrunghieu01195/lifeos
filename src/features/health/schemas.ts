import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

export const logWeightSchema = z.object({
  date: dateOnly,
  kg: z
    .number()
    .min(20, "Weight must be at least 20 kg.")
    .max(500, "Weight must be under 500 kg.")
    .multipleOf(0.1, "Weight supports one decimal place."),
  notes: z.string().trim().max(200).default(""),
});

export const logSleepSchema = z.object({
  date: dateOnly,
  hours: z
    .number()
    .min(0.5, "Minimum 30 minutes.")
    .max(24, "Maximum 24 hours.")
    .multipleOf(0.5, "Sleep duration supports 30-minute steps."),
  quality: z.number().int().min(1).max(5),
  notes: z.string().trim().max(200).default(""),
});

export const logWaterSchema = z.object({
  date: dateOnly,
  /** Absolute glasses for the day (replaces any existing value). */
  glasses: z.number().int().min(0).max(30),
  notes: z.string().trim().max(200).default(""),
});

export const logWorkoutSchema = z.object({
  date: dateOnly,
  name: z.string().trim().min(1, "Exercise name is required.").max(80),
  workoutType: z.enum(["CARDIO", "STRENGTH", "FLEXIBILITY", "OTHER"]),
  durationMinutes: z.number().int().min(1, "Duration must be at least 1 minute.").max(600),
  notes: z.string().trim().max(200).default(""),
});

export type LogWeightInput = z.infer<typeof logWeightSchema>;
export type LogSleepInput = z.infer<typeof logSleepSchema>;
export type LogWaterInput = z.infer<typeof logWaterSchema>;
export type LogWorkoutInput = z.infer<typeof logWorkoutSchema>;
