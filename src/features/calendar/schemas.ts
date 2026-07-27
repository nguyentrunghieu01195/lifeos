import { z } from "zod";

const isoDate = z.string().datetime({ offset: true });

const eventCore = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().trim().max(4000).optional(),
  location: z.string().trim().max(200).optional(),
  startAt: isoDate,
  endAt: isoDate,
  allDay: z.boolean().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex color like #6366f1.")
    .optional(),
});

function endAfterStart(data: { startAt: string; endAt: string }): boolean {
  return new Date(data.endAt).getTime() > new Date(data.startAt).getTime();
}

export const createEventSchema = eventCore.refine(endAfterStart, {
  message: "End must be after start.",
  path: ["endAt"],
});

export const updateEventSchema = eventCore
  .partial()
  .extend({ id: z.string().cuid() })
  .refine(
    (data) =>
      data.startAt === undefined || data.endAt === undefined || endAfterStart(data as never),
    { message: "End must be after start.", path: ["endAt"] },
  );

export const moveEventSchema = z
  .object({
    id: z.string().cuid(),
    startAt: isoDate,
    endAt: isoDate,
  })
  .refine(endAfterStart, { message: "End must be after start.", path: ["endAt"] });

export const calendarRangeSchema = z.object({
  from: isoDate,
  to: isoDate,
});

export const aiScheduleSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(3, "Describe what you want to schedule.")
    .max(1000, "Keep the prompt under 1000 characters."),
  /** The viewer's current date (YYYY-MM-DD) so relative dates resolve in their timezone. */
  todayDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** JS getTimezoneOffset() convention: UTC minus local, in minutes. */
  tzOffsetMinutes: z.number().int().min(-840).max(840),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type MoveEventInput = z.infer<typeof moveEventSchema>;
export type AiScheduleInput = z.infer<typeof aiScheduleSchema>;
