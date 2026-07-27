import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDb } from "@/lib/db";

import { subtractDays } from "../lib/streak";
import {
  archiveHabit,
  createHabit,
  getHabitDetail,
  getTodayHabits,
  listHabits,
  toggleCheckIn,
  updateHabit,
} from "./service";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

const TODAY = new Date().toISOString().slice(0, 10);

describe.runIf(hasDatabase)("habits service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-habits-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-habits-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates and lists habits with today status", async () => {
    const habit = await createHabit(userA, {
      name: "Morning run",
      icon: "🏃",
      color: "#22c55e",
      frequency: "DAILY",
      targetCount: 1,
    });
    expect(habit.name).toBe("Morning run");

    const habits = await listHabits(userA, TODAY);
    const found = habits.find((entry) => entry.id === habit.id);
    expect(found).toBeDefined();
    expect(found?.completedToday).toBe(false);
    expect(found?.streak).toBe(0);
  });

  it("toggles check-ins and computes daily streak", async () => {
    const habit = await createHabit(userA, {
      name: "Meditate",
      icon: "🧘",
      color: "#6366f1",
      frequency: "DAILY",
      targetCount: 1,
    });

    // Check in for today and the past 3 days.
    for (let i = 0; i <= 3; i++) {
      await toggleCheckIn(userA, habit.id, subtractDays(TODAY, i));
    }

    let habits = await listHabits(userA, TODAY);
    let found = habits.find((entry) => entry.id === habit.id)!;
    expect(found.completedToday).toBe(true);
    expect(found.streak).toBe(4);
    expect(found.recentDates).toContain(TODAY);

    // Toggle off today → streak drops to 3 (yesterday through 3 days ago).
    await toggleCheckIn(userA, habit.id, TODAY);

    habits = await listHabits(userA, TODAY);
    found = habits.find((entry) => entry.id === habit.id)!;
    expect(found.completedToday).toBe(false);
    expect(found.streak).toBe(3);
  });

  it("computes weekly streak for WEEKLY habits", async () => {
    const habit = await createHabit(userA, {
      name: "Swim",
      icon: "🏊",
      color: "#0ea5e9",
      frequency: "WEEKLY",
      targetCount: 2,
    });

    // 3 completions this week and 3 last week.
    for (let w = 0; w <= 1; w++) {
      for (let d = 0; d < 3; d++) {
        await toggleCheckIn(userA, habit.id, subtractDays(TODAY, w * 7 + d));
      }
    }

    const habits = await listHabits(userA, TODAY);
    const found = habits.find((entry) => entry.id === habit.id)!;
    expect(found.streak).toBe(2);
  });

  it("getHabitDetail returns heatmap and best streak", async () => {
    const habit = await createHabit(userA, {
      name: "Read",
      icon: "📚",
      color: "#f97316",
      frequency: "DAILY",
      targetCount: 1,
    });

    for (let i = 0; i < 5; i++) {
      await toggleCheckIn(userA, habit.id, subtractDays(TODAY, i));
    }

    const detail = await getHabitDetail(userA, habit.id, TODAY);
    expect(detail.bestStreak).toBe(5);
    expect(detail.totalCompletions).toBe(5);
    expect(detail.allDates).toContain(TODAY);
  });

  it("prevents duplicate check-ins for the same day", async () => {
    const habit = await createHabit(userA, {
      name: "Journal",
      icon: "📓",
      color: "#8b5cf6",
      frequency: "DAILY",
      targetCount: 1,
    });

    await toggleCheckIn(userA, habit.id, TODAY);
    await toggleCheckIn(userA, habit.id, TODAY); // should remove

    const detail = await getHabitDetail(userA, habit.id, TODAY);
    expect(detail.completedToday).toBe(false);
    expect(detail.totalCompletions).toBe(0);
  });

  it("archives habits and hides them from the active list", async () => {
    const habit = await createHabit(userA, {
      name: "Yoga",
      icon: "🧘",
      color: "#ec4899",
      frequency: "DAILY",
      targetCount: 1,
    });

    let habits = await listHabits(userA, TODAY);
    expect(habits.some((entry) => entry.id === habit.id)).toBe(true);

    await archiveHabit(userA, habit.id);

    habits = await listHabits(userA, TODAY);
    expect(habits.some((entry) => entry.id === habit.id)).toBe(false);
  });

  it("never exposes another user's habits", async () => {
    const habit = await createHabit(userA, {
      name: "Secret habit",
      icon: "🔒",
      color: "#64748b",
      frequency: "DAILY",
      targetCount: 1,
    });
    await toggleCheckIn(userA, habit.id, TODAY);

    await expect(getHabitDetail(userB, habit.id, TODAY)).rejects.toThrow("not found");
    await expect(toggleCheckIn(userB, habit.id, TODAY)).rejects.toThrow("not found");
    await expect(archiveHabit(userB, habit.id)).rejects.toThrow("not found");
    await expect(updateHabit(userB, { id: habit.id, name: "Hacked" })).rejects.toThrow("not found");

    const listB = await listHabits(userB, TODAY);
    expect(listB.some((entry) => entry.id === habit.id)).toBe(false);
  });

  it("getTodayHabits returns dashboard data", async () => {
    const habit = await createHabit(userB, {
      name: "Walk",
      icon: "🚶",
      color: "#10b981",
      frequency: "DAILY",
      targetCount: 1,
    });

    let result = await getTodayHabits(userB);
    const initial = result.habits.find((entry) => entry.id === habit.id);
    expect(initial?.done).toBe(false);

    await toggleCheckIn(userB, habit.id, TODAY);

    result = await getTodayHabits(userB);
    expect(result.habits.find((entry) => entry.id === habit.id)?.done).toBe(true);
    expect(result.done).toBeGreaterThanOrEqual(1);
  });
});
