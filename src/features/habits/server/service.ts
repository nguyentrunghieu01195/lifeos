import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import {
  bestDailyStreak,
  bestWeeklyStreak,
  buildMiniHeatmap,
  dailyStreak,
  subtractDays,
  weeklyStreak,
} from "../lib/streak";
import type { CreateHabitInput, UpdateHabitInput } from "../schemas";
import type { HabitDetailDto, HabitDto, HabitWithStatsDto } from "../types";

/** Habits domain service — every read/write is scoped to the explicit userId. */

// Store and retrieve dates as UTC midnight DateTimes.
function dateStringToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}
function utcToDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

const habitSelect = {
  id: true,
  name: true,
  icon: true,
  color: true,
  frequency: true,
  targetCount: true,
  isActive: true,
  createdAt: true,
};

type HabitRecord = {
  id: string;
  name: string;
  icon: string;
  color: string;
  frequency: "DAILY" | "WEEKLY";
  targetCount: number;
  isActive: boolean;
  createdAt: Date;
};

function toHabitDto(record: HabitRecord): HabitDto {
  return { ...record, createdAt: record.createdAt.toISOString() };
}

function computeStats(
  habit: HabitDto,
  completedDates: string[],
  today: string,
): { streak: number; completedToday: boolean; recentDates: string[] } {
  const completedToday = completedDates.includes(today);
  const streak =
    habit.frequency === "DAILY"
      ? dailyStreak(completedDates, today)
      : weeklyStreak(completedDates, habit.targetCount, today);
  const recentDates = buildMiniHeatmap(completedDates, today)
    .filter((cell) => cell.completed)
    .map((cell) => cell.date);
  return { streak, completedToday, recentDates };
}

// ---------------------------------------------------------------------------
// Habits CRUD
// ---------------------------------------------------------------------------

export async function listHabits(userId: string, today: string): Promise<HabitWithStatsDto[]> {
  const cutoff = subtractDays(today, 365);
  const db = getDb();

  const [habitRows, logRows] = await Promise.all([
    db.habit.findMany({
      where: { userId, isActive: true },
      select: habitSelect,
      orderBy: { createdAt: "asc" },
    }),
    db.habitLog.findMany({
      where: { userId, occurredAt: { gte: dateStringToUtc(cutoff) } },
      select: { habitId: true, occurredAt: true },
    }),
  ]);

  // Group logs by habitId.
  const datesByHabit = new Map<string, string[]>();
  for (const log of logRows) {
    const key = log.habitId;
    const existing = datesByHabit.get(key);
    const dateStr = utcToDateString(log.occurredAt);
    if (existing) {
      existing.push(dateStr);
    } else {
      datesByHabit.set(key, [dateStr]);
    }
  }

  return habitRows.map((row) => {
    const habit = toHabitDto(row as HabitRecord);
    const dates = datesByHabit.get(habit.id) ?? [];
    return { ...habit, ...computeStats(habit, dates, today) };
  });
}

export async function getHabitDetail(
  userId: string,
  id: string,
  today: string,
): Promise<HabitDetailDto> {
  const db = getDb();
  const [habitRow, logRows] = await Promise.all([
    db.habit.findFirst({ where: { id, userId }, select: habitSelect }),
    db.habitLog.findMany({
      where: { habitId: id, userId },
      select: { occurredAt: true },
      orderBy: { occurredAt: "asc" },
    }),
  ]);

  if (!habitRow) {
    throw new AppError("Habit not found.", { code: "NOT_FOUND", status: 404 });
  }

  const habit = toHabitDto(habitRow as HabitRecord);
  const allDates = logRows.map((log) => utcToDateString(log.occurredAt));

  const bestStreak =
    habit.frequency === "DAILY"
      ? bestDailyStreak(allDates)
      : bestWeeklyStreak(allDates, habit.targetCount, today);

  return {
    ...habit,
    ...computeStats(habit, allDates, today),
    bestStreak,
    totalCompletions: allDates.length,
    allDates,
  };
}

export async function createHabit(userId: string, input: CreateHabitInput): Promise<HabitDto> {
  const row = await getDb().habit.create({
    data: { userId, ...input },
    select: habitSelect,
  });
  return toHabitDto(row as HabitRecord);
}

export async function updateHabit(
  userId: string,
  input: UpdateHabitInput,
): Promise<HabitWithStatsDto> {
  const existing = await getDb().habit.findFirst({ where: { id: input.id, userId } });
  if (!existing) {
    throw new AppError("Habit not found.", { code: "NOT_FOUND", status: 404 });
  }

  const { id, ...data } = input;
  const row = await getDb().habit.update({
    where: { id },
    data,
    select: habitSelect,
  });
  const today = new Date().toISOString().slice(0, 10);
  const logRows = await getDb().habitLog.findMany({
    where: { habitId: id, userId },
    select: { occurredAt: true },
  });
  const allDates = logRows.map((log) => utcToDateString(log.occurredAt));
  const habit = toHabitDto(row as HabitRecord);
  return { ...habit, ...computeStats(habit, allDates, today) };
}

export async function archiveHabit(userId: string, id: string): Promise<void> {
  const result = await getDb().habit.updateMany({
    where: { id, userId },
    data: { isActive: false },
  });
  if (result.count === 0) {
    throw new AppError("Habit not found.", { code: "NOT_FOUND", status: 404 });
  }
}

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

/** Toggle: creates a log if absent, deletes it if present. Returns new status. */
export async function toggleCheckIn(
  userId: string,
  habitId: string,
  date: string,
): Promise<{ completedToday: boolean }> {
  const db = getDb();
  const habit = await db.habit.findFirst({ where: { id: habitId, userId } });
  if (!habit) {
    throw new AppError("Habit not found.", { code: "NOT_FOUND", status: 404 });
  }

  const occurredAt = dateStringToUtc(date);
  const existing = await db.habitLog.findFirst({
    where: { habitId, occurredAt },
    select: { id: true },
  });

  if (existing) {
    await db.habitLog.delete({ where: { id: existing.id } });
    return { completedToday: false };
  }

  await db.habitLog.create({ data: { habitId, userId, occurredAt } });
  return { completedToday: true };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Today's habits for the dashboard widget. */
export async function getTodayHabits(userId: string): Promise<{
  total: number;
  done: number;
  habits: Array<{ id: string; name: string; icon: string; color: string; done: boolean }>;
}> {
  const today = new Date().toISOString().slice(0, 10);
  const todayUtc = dateStringToUtc(today);

  const [habits, logs] = await Promise.all([
    getDb().habit.findMany({
      where: { userId, isActive: true },
      select: { id: true, name: true, icon: true, color: true },
      orderBy: { createdAt: "asc" },
      take: 6,
    }),
    getDb().habitLog.findMany({
      where: { userId, occurredAt: todayUtc },
      select: { habitId: true },
    }),
  ]);

  const doneIds = new Set(logs.map((log) => log.habitId));
  const result = habits.map((habit) => ({ ...habit, done: doneIds.has(habit.id) }));
  return {
    total: habits.length,
    done: result.filter((habit) => habit.done).length,
    habits: result,
  };
}

/** Archived habits for the archive page. */
export async function listArchivedHabits(userId: string): Promise<HabitDto[]> {
  const rows = await getDb().habit.findMany({
    where: { userId, isActive: false },
    select: habitSelect,
    orderBy: { updatedAt: "desc" },
  });
  return rows.map((row) => toHabitDto(row as HabitRecord));
}
