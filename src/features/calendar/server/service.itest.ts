import { addDays, addHours } from "date-fns";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createAiEvents,
  createEvent,
  deleteEvent,
  getCalendarData,
  listEventsInRange,
  moveEvent,
  updateEvent,
} from "@/features/calendar/server/service";
import { createTask } from "@/features/tasks/server/service";
import { getDb } from "@/lib/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

function isoIn(hours: number): string {
  return addHours(new Date(), hours).toISOString();
}

describe.runIf(hasDatabase)("calendar service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-cal-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-cal-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates, updates, moves and deletes an event", async () => {
    const event = await createEvent(userA, {
      title: "Standup",
      startAt: isoIn(1),
      endAt: isoIn(2),
    });
    expect(event.source).toBe("LOCAL");

    const updated = await updateEvent(userA, { id: event.id, title: "Daily standup" });
    expect(updated.title).toBe("Daily standup");

    const movedStart = isoIn(24);
    const moved = await moveEvent(userA, { id: event.id, startAt: movedStart, endAt: isoIn(25) });
    expect(moved.startAt).toBe(movedStart);

    await deleteEvent(userA, event.id);
    await expect(updateEvent(userA, { id: event.id, title: "x" })).rejects.toThrow(
      "Event not found",
    );
  });

  it("range queries include events overlapping the boundaries", async () => {
    const now = new Date();
    const spanning = await createEvent(userA, {
      title: "Overnight retreat",
      startAt: addHours(now, -6).toISOString(),
      endAt: addHours(now, 6).toISOString(),
    });

    const events = await listEventsInRange(userA, now, addHours(now, 1));
    expect(events.some((event) => event.id === spanning.id)).toBe(true);

    const outside = await listEventsInRange(userA, addDays(now, 10), addDays(now, 11));
    expect(outside.some((event) => event.id === spanning.id)).toBe(false);
  });

  it("merges tasks with due dates into calendar data", async () => {
    const due = addHours(new Date(), 3);
    await createTask(userA, { title: "Calendar-visible task", dueAt: due.toISOString() });

    const data = await getCalendarData(userA, new Date(), addDays(new Date(), 1));
    expect(data.tasks.some((task) => task.title === "Calendar-visible task")).toBe(true);
  });

  it("enforces ownership across users", async () => {
    const event = await createEvent(userA, {
      title: "Private meeting",
      startAt: isoIn(2),
      endAt: isoIn(3),
    });

    await expect(updateEvent(userB, { id: event.id, title: "hijack" })).rejects.toThrow(
      "Event not found",
    );
    await expect(deleteEvent(userB, event.id)).rejects.toThrow("Event not found");

    const eventsForB = await listEventsInRange(userB, new Date(), addDays(new Date(), 2));
    expect(eventsForB.some((candidate) => candidate.id === event.id)).toBe(false);
  });

  it("creates AI events with timezone-correct instants and sane defaults", async () => {
    const [event] = await createAiEvents(
      userA,
      [{ title: "Dentist", date: "2030-01-15", startTime: "15:00" }],
      -420, // UTC+7 viewer
    );

    expect(event?.startAt).toBe("2030-01-15T08:00:00.000Z");
    // Default duration: one hour.
    expect(event?.endAt).toBe("2030-01-15T09:00:00.000Z");
  });
});
