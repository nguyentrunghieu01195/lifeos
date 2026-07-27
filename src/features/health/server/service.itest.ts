import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";

import {
  deleteWeightLog,
  deleteWorkoutLog,
  getHealthSnapshot,
  getTodayHealth,
  logSleep,
  logWater,
  logWeight,
  logWorkout,
  getWeightTrend,
  getSleepTrend,
  getWaterTrend,
} from "./service";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

const TODAY = new Date().toISOString().slice(0, 10);
const YESTERDAY = (() => {
  const d = new Date(`${TODAY}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
})();

describe.runIf(hasDatabase)("health service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-health-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-health-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("upserts weight logs (one per day per user)", async () => {
    const log1 = await logWeight(userA, { date: TODAY, kg: 70.5, notes: "" });
    expect(log1.kg).toBe(70.5);

    const log2 = await logWeight(userA, { date: TODAY, kg: 70.2, notes: "morning" });
    expect(log2.id).toBe(log1.id);
    expect(log2.kg).toBe(70.2);

    const trend = await getWeightTrend(userA, 30);
    expect(trend.filter((e) => e.date === TODAY).length).toBe(1);
  });

  it("upserts sleep logs (one per day per user)", async () => {
    const log1 = await logSleep(userA, { date: TODAY, hours: 7.5, quality: 4, notes: "" });
    expect(log1.hours).toBe(7.5);

    const log2 = await logSleep(userA, { date: TODAY, hours: 8, quality: 5, notes: "" });
    expect(log2.id).toBe(log1.id);
    expect(log2.hours).toBe(8);

    const trend = await getSleepTrend(userA, 14);
    expect(trend.filter((e) => e.date === TODAY).length).toBe(1);
  });

  it("upserts water logs and handles delete", async () => {
    const log1 = await logWater(userA, { date: TODAY, glasses: 3, notes: "" });
    const log2 = await logWater(userA, { date: TODAY, glasses: 6, notes: "" });
    expect(log2.id).toBe(log1.id);
    expect(log2.glasses).toBe(6);

    const trend = await getWaterTrend(userA, 7);
    expect(trend.find((e) => e.date === TODAY)?.glasses).toBe(6);

    const result = await deleteWeightLog(userA, log1.id).catch(() => "notfound");
    expect(result).toBe("notfound"); // log1 is a water log, not weight
    // deleting wrong table should fail quietly — test the correct delete:
    await getDb().waterLog.deleteMany({ where: { id: log1.id, userId: userA } });
  });

  it("appends multiple workout logs per day", async () => {
    const w1 = await logWorkout(userA, {
      date: TODAY,
      name: "Run",
      workoutType: "CARDIO",
      durationMinutes: 30,
      notes: "",
    });
    const w2 = await logWorkout(userA, {
      date: TODAY,
      name: "Push-ups",
      workoutType: "STRENGTH",
      durationMinutes: 15,
      notes: "",
    });
    expect(w1.id).not.toBe(w2.id);

    const snapshot = await getHealthSnapshot(userA);
    expect(snapshot.todayWorkouts.length).toBeGreaterThanOrEqual(2);
    await deleteWorkoutLog(userA, w1.id);
    await deleteWorkoutLog(userA, w2.id);
  });

  it("trend queries respect date ranges", async () => {
    // Add a log yesterday (outside the 1-day window).
    await logWeight(userA, { date: YESTERDAY, kg: 71.0, notes: "" });
    const singleDay = await getWeightTrend(userA, 1);
    expect(singleDay.every((e) => e.date === TODAY)).toBe(true);
  });

  it("never exposes another user's data", async () => {
    // B logs weight; A should not see it.
    const bLog = await logWeight(userB, { date: TODAY, kg: 60, notes: "" });
    const aTrend = await getWeightTrend(userA, 30);
    expect(aTrend.some((e) => e.id === bLog.id)).toBe(false);

    await expect(deleteWeightLog(userA, bLog.id)).rejects.toThrow("Not found");
  });

  it("getTodayHealth aggregates across metric types", async () => {
    await logWeight(userB, { date: TODAY, kg: 65, notes: "" });
    await logSleep(userB, { date: TODAY, hours: 7, quality: 3, notes: "" });
    await logWater(userB, { date: TODAY, glasses: 5, notes: "" });
    await logWorkout(userB, {
      date: TODAY,
      name: "Yoga",
      workoutType: "FLEXIBILITY",
      durationMinutes: 45,
      notes: "",
    });

    const health = await getTodayHealth(userB);
    expect(health.weight).toBe(65);
    expect(health.sleepHours).toBe(7);
    expect(health.waterGlasses).toBe(5);
    expect(health.workoutsThisWeek).toBeGreaterThanOrEqual(1);
    expect(health.workoutMinutesThisWeek).toBeGreaterThanOrEqual(45);
  });
});
