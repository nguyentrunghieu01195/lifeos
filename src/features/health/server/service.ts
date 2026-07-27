import "server-only";

import type { Decimal } from "@prisma/client/runtime/library";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import { subtractDaysFromDate, dateStringToUtc, utcToDateString } from "../lib/metrics";
import type { LogSleepInput, LogWaterInput, LogWeightInput, LogWorkoutInput } from "../schemas";
import type {
  HealthSnapshot,
  SleepLogDto,
  TodayHealthDto,
  WaterLogDto,
  WeightLogDto,
  WorkoutLogDto,
} from "../types";

/** Health domain service — every read/write is scoped to the explicit userId. */

const d = (v: Decimal) => Number(v);

// ---------------------------------------------------------------------------
// DTOs
// ---------------------------------------------------------------------------

function toWeight(row: { id: string; date: Date; kg: Decimal; notes: string }): WeightLogDto {
  return { id: row.id, date: utcToDateString(row.date), kg: d(row.kg), notes: row.notes };
}

function toSleep(row: {
  id: string;
  date: Date;
  hours: Decimal;
  quality: number;
  notes: string;
}): SleepLogDto {
  return {
    id: row.id,
    date: utcToDateString(row.date),
    hours: d(row.hours),
    quality: row.quality,
    notes: row.notes,
  };
}

function toWater(row: { id: string; date: Date; glasses: number; notes: string }): WaterLogDto {
  return { id: row.id, date: utcToDateString(row.date), glasses: row.glasses, notes: row.notes };
}

function toWorkout(row: {
  id: string;
  date: Date;
  name: string;
  workoutType: string;
  durationMinutes: number;
  notes: string;
}): WorkoutLogDto {
  return {
    id: row.id,
    date: utcToDateString(row.date),
    name: row.name,
    workoutType: row.workoutType as WorkoutLogDto["workoutType"],
    durationMinutes: row.durationMinutes,
    notes: row.notes,
  };
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

export async function logWeight(userId: string, input: LogWeightInput): Promise<WeightLogDto> {
  const occurredAt = dateStringToUtc(input.date);
  const db = getDb();

  const existing = await db.weightLog.findUnique({
    where: { userId_date: { userId, date: occurredAt } },
  });

  const row = existing
    ? await db.weightLog.update({
        where: { id: existing.id },
        data: { kg: input.kg, notes: input.notes },
      })
    : await db.weightLog.create({
        data: { userId, date: occurredAt, kg: input.kg, notes: input.notes },
      });

  return toWeight(row);
}

export async function deleteWeightLog(userId: string, id: string): Promise<void> {
  const result = await getDb().weightLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new AppError("Not found.", { code: "NOT_FOUND", status: 404 });
}

export async function getWeightTrend(userId: string, days = 30): Promise<WeightLogDto[]> {
  const cutoff = dateStringToUtc(
    subtractDaysFromDate(new Date().toISOString().slice(0, 10), days - 1),
  );
  const rows = await getDb().weightLog.findMany({
    where: { userId, date: { gte: cutoff } },
    orderBy: { date: "asc" },
  });
  return rows.map(toWeight);
}

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

export async function logSleep(userId: string, input: LogSleepInput): Promise<SleepLogDto> {
  const occurredAt = dateStringToUtc(input.date);
  const db = getDb();

  const existing = await db.sleepLog.findUnique({
    where: { userId_date: { userId, date: occurredAt } },
  });

  const row = existing
    ? await db.sleepLog.update({
        where: { id: existing.id },
        data: { hours: input.hours, quality: input.quality, notes: input.notes },
      })
    : await db.sleepLog.create({
        data: {
          userId,
          date: occurredAt,
          hours: input.hours,
          quality: input.quality,
          notes: input.notes,
        },
      });

  return toSleep(row);
}

export async function deleteSleepLog(userId: string, id: string): Promise<void> {
  const result = await getDb().sleepLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new AppError("Not found.", { code: "NOT_FOUND", status: 404 });
}

export async function getSleepTrend(userId: string, days = 14): Promise<SleepLogDto[]> {
  const cutoff = dateStringToUtc(
    subtractDaysFromDate(new Date().toISOString().slice(0, 10), days - 1),
  );
  const rows = await getDb().sleepLog.findMany({
    where: { userId, date: { gte: cutoff } },
    orderBy: { date: "asc" },
  });
  return rows.map(toSleep);
}

// ---------------------------------------------------------------------------
// Water
// ---------------------------------------------------------------------------

export async function logWater(userId: string, input: LogWaterInput): Promise<WaterLogDto> {
  const occurredAt = dateStringToUtc(input.date);
  const db = getDb();

  const existing = await db.waterLog.findUnique({
    where: { userId_date: { userId, date: occurredAt } },
  });

  const row = existing
    ? await db.waterLog.update({
        where: { id: existing.id },
        data: { glasses: input.glasses, notes: input.notes },
      })
    : await db.waterLog.create({
        data: { userId, date: occurredAt, glasses: input.glasses, notes: input.notes },
      });

  return toWater(row);
}

export async function deleteWaterLog(userId: string, id: string): Promise<void> {
  const result = await getDb().waterLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new AppError("Not found.", { code: "NOT_FOUND", status: 404 });
}

export async function getWaterTrend(userId: string, days = 7): Promise<WaterLogDto[]> {
  const cutoff = dateStringToUtc(
    subtractDaysFromDate(new Date().toISOString().slice(0, 10), days - 1),
  );
  const rows = await getDb().waterLog.findMany({
    where: { userId, date: { gte: cutoff } },
    orderBy: { date: "asc" },
  });
  return rows.map(toWater);
}

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

export async function logWorkout(userId: string, input: LogWorkoutInput): Promise<WorkoutLogDto> {
  const row = await getDb().workoutLog.create({
    data: {
      userId,
      date: dateStringToUtc(input.date),
      name: input.name,
      workoutType: input.workoutType,
      durationMinutes: input.durationMinutes,
      notes: input.notes,
    },
  });
  return toWorkout(row);
}

export async function deleteWorkoutLog(userId: string, id: string): Promise<void> {
  const result = await getDb().workoutLog.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new AppError("Not found.", { code: "NOT_FOUND", status: 404 });
}

export async function getRecentWorkouts(userId: string, limit = 20): Promise<WorkoutLogDto[]> {
  const rows = await getDb().workoutLog.findMany({
    where: { userId },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return rows.map(toWorkout);
}

// ---------------------------------------------------------------------------
// Snapshot for the page
// ---------------------------------------------------------------------------

export async function getHealthSnapshot(userId: string): Promise<HealthSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const todayUtc = dateStringToUtc(today);

  const [
    todayWeight,
    todaySleep,
    todayWater,
    todayWorkouts,
    weightTrend,
    sleepTrend,
    waterTrend,
    recentWorkouts,
  ] = await Promise.all([
    getDb().weightLog.findUnique({ where: { userId_date: { userId, date: todayUtc } } }),
    getDb().sleepLog.findUnique({ where: { userId_date: { userId, date: todayUtc } } }),
    getDb().waterLog.findUnique({ where: { userId_date: { userId, date: todayUtc } } }),
    getDb().workoutLog.findMany({
      where: { userId, date: todayUtc },
      orderBy: { createdAt: "asc" },
    }),
    getWeightTrend(userId, 30),
    getSleepTrend(userId, 14),
    getWaterTrend(userId, 7),
    getRecentWorkouts(userId, 20),
  ]);

  return {
    today,
    todayWeight: todayWeight ? toWeight(todayWeight) : null,
    todaySleep: todaySleep ? toSleep(todaySleep) : null,
    todayWater: todayWater ? toWater(todayWater) : null,
    todayWorkouts: todayWorkouts.map(toWorkout),
    weightTrend,
    sleepTrend,
    waterTrend,
    recentWorkouts,
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getTodayHealth(userId: string): Promise<TodayHealthDto> {
  const today = new Date().toISOString().slice(0, 10);
  const todayUtc = dateStringToUtc(today);
  const weekStartUtc = dateStringToUtc(subtractDaysFromDate(today, 6));

  const [weight, sleep, water, weekWorkouts] = await Promise.all([
    getDb().weightLog.findUnique({
      where: { userId_date: { userId, date: todayUtc } },
      select: { kg: true },
    }),
    getDb().sleepLog.findUnique({
      where: { userId_date: { userId, date: todayUtc } },
      select: { hours: true, quality: true },
    }),
    getDb().waterLog.findUnique({
      where: { userId_date: { userId, date: todayUtc } },
      select: { glasses: true },
    }),
    getDb().workoutLog.findMany({
      where: { userId, date: { gte: weekStartUtc } },
      select: { durationMinutes: true },
    }),
  ]);

  return {
    today,
    weight: weight ? d(weight.kg) : null,
    sleepHours: sleep ? d(sleep.hours) : null,
    sleepQuality: sleep ? sleep.quality : null,
    waterGlasses: water?.glasses ?? 0,
    workoutsThisWeek: weekWorkouts.length,
    workoutMinutesThisWeek: weekWorkouts.reduce((acc, w) => acc + w.durationMinutes, 0),
  };
}

// ---------------------------------------------------------------------------
// For AI analysis
// ---------------------------------------------------------------------------

export async function getHealthDataForAI(userId: string): Promise<string> {
  const snapshot = await getHealthSnapshot(userId);

  const lines: string[] = [];
  if (snapshot.weightTrend.length) {
    const latest = snapshot.weightTrend.at(-1)!;
    const oldest = snapshot.weightTrend[0]!;
    lines.push(
      `Weight (last 30 days): ${latest.kg} kg. Started at ${oldest.kg} kg, delta ${(latest.kg - oldest.kg).toFixed(1)} kg.`,
    );
  }
  if (snapshot.sleepTrend.length) {
    const avgHours =
      snapshot.sleepTrend.reduce((acc, s) => acc + s.hours, 0) / snapshot.sleepTrend.length;
    const avgQuality =
      snapshot.sleepTrend.reduce((acc, s) => acc + s.quality, 0) / snapshot.sleepTrend.length;
    lines.push(
      `Sleep (last 14 nights): avg ${avgHours.toFixed(1)}h, avg quality ${avgQuality.toFixed(1)}/5.`,
    );
  }
  if (snapshot.waterTrend.length) {
    const avgGlasses =
      snapshot.waterTrend.reduce((acc, w) => acc + w.glasses, 0) / snapshot.waterTrend.length;
    lines.push(`Water (last 7 days): avg ${avgGlasses.toFixed(1)} glasses/day (target 8).`);
  }
  if (snapshot.recentWorkouts.length) {
    const totalMin = snapshot.recentWorkouts.reduce((acc, w) => acc + w.durationMinutes, 0);
    lines.push(
      `Workouts (recent): ${snapshot.recentWorkouts.length} sessions, ${totalMin} total minutes. Types: ${[...new Set(snapshot.recentWorkouts.map((w) => w.workoutType))].join(", ")}.`,
    );
  }

  if (lines.length === 0) return "No health data recorded yet.";
  return lines.join("\n");
}
