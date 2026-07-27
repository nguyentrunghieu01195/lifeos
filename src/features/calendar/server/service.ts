import "server-only";

import { getDb } from "@/lib/db";
import { AppError } from "@/lib/errors";

import { dateFromLocalParts } from "../lib/time";
import type { AiEventItem } from "../lib/ai-parse";
import type { CreateEventInput, MoveEventInput, UpdateEventInput } from "../schemas";
import type { CalendarDataDto, EventDto, TaskCalendarItemDto } from "../types";

/**
 * Calendar domain service — same contract as tasks: every function takes an
 * explicit userId and scopes all reads and writes to it.
 */

type EventRecord = NonNullable<
  Awaited<ReturnType<ReturnType<typeof getDb>["calendarEvent"]["findFirst"]>>
>;

function toEventDto(event: EventRecord): EventDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt.toISOString(),
    allDay: event.allDay,
    color: event.color,
    source: event.source,
    createdAt: event.createdAt.toISOString(),
  };
}

async function findOwnedEvent(userId: string, id: string): Promise<EventRecord> {
  const event = await getDb().calendarEvent.findFirst({ where: { id, userId } });
  if (!event) {
    throw new AppError("Event not found.", { code: "NOT_FOUND", status: 404 });
  }
  return event;
}

// --- Reads -------------------------------------------------------------------

/** Events overlapping [from, to) — span-inclusive so multi-day events appear. */
export async function listEventsInRange(userId: string, from: Date, to: Date): Promise<EventDto[]> {
  const events = await getDb().calendarEvent.findMany({
    where: { userId, startAt: { lt: to }, endAt: { gt: from } },
    orderBy: { startAt: "asc" },
  });
  return events.map(toEventDto);
}

/** Open + done tasks with a due date inside the range (read-only calendar chips). */
export async function listTaskCalendarItems(
  userId: string,
  from: Date,
  to: Date,
): Promise<TaskCalendarItemDto[]> {
  const tasks = await getDb().task.findMany({
    where: { userId, parentId: null, dueAt: { gte: from, lt: to } },
    select: { id: true, title: true, dueAt: true, status: true, priority: true },
    orderBy: { dueAt: "asc" },
  });
  return tasks.map((task) => ({
    id: task.id,
    title: task.title,
    dueAt: (task.dueAt as Date).toISOString(),
    status: task.status,
    priority: task.priority,
  }));
}

export async function getCalendarData(
  userId: string,
  from: Date,
  to: Date,
): Promise<CalendarDataDto> {
  const [events, tasks] = await Promise.all([
    listEventsInRange(userId, from, to),
    listTaskCalendarItems(userId, from, to),
  ]);
  return { events, tasks };
}

/** Dashboard widget: the next few upcoming events from now. */
export async function getUpcomingEvents(userId: string, take = 5): Promise<EventDto[]> {
  const events = await getDb().calendarEvent.findMany({
    where: { userId, endAt: { gte: new Date() } },
    orderBy: { startAt: "asc" },
    take,
  });
  return events.map(toEventDto);
}

// --- Writes ------------------------------------------------------------------

export async function createEvent(userId: string, input: CreateEventInput): Promise<EventDto> {
  const event = await getDb().calendarEvent.create({
    data: {
      userId,
      title: input.title,
      description: input.description || null,
      location: input.location || null,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      allDay: input.allDay ?? false,
      ...(input.color ? { color: input.color } : {}),
    },
  });
  return toEventDto(event);
}

export async function updateEvent(userId: string, input: UpdateEventInput): Promise<EventDto> {
  await findOwnedEvent(userId, input.id);

  const data: Record<string, unknown> = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description || null;
  if (input.location !== undefined) data.location = input.location || null;
  if (input.startAt !== undefined) data.startAt = new Date(input.startAt);
  if (input.endAt !== undefined) data.endAt = new Date(input.endAt);
  if (input.allDay !== undefined) data.allDay = input.allDay;
  if (input.color !== undefined) data.color = input.color;

  const event = await getDb().calendarEvent.update({ where: { id: input.id }, data });
  return toEventDto(event);
}

/** Drag-and-drop reschedule. */
export async function moveEvent(userId: string, input: MoveEventInput): Promise<EventDto> {
  await findOwnedEvent(userId, input.id);
  const event = await getDb().calendarEvent.update({
    where: { id: input.id },
    data: { startAt: new Date(input.startAt), endAt: new Date(input.endAt) },
  });
  return toEventDto(event);
}

export async function deleteEvent(userId: string, id: string): Promise<void> {
  const result = await getDb().calendarEvent.deleteMany({ where: { id, userId } });
  if (result.count === 0) {
    throw new AppError("Event not found.", { code: "NOT_FOUND", status: 404 });
  }
}

const DEFAULT_EVENT_MINUTES = 60;

/** Bulk-create AI-scheduled events from the validated contract. */
export async function createAiEvents(
  userId: string,
  items: AiEventItem[],
  tzOffsetMinutes: number,
): Promise<EventDto[]> {
  const created: EventDto[] = [];
  for (const item of items) {
    const allDay = item.allDay ?? false;
    const startAt = dateFromLocalParts(
      item.date,
      allDay ? "00:00" : item.startTime,
      tzOffsetMinutes,
    );
    const endAt = item.endTime
      ? dateFromLocalParts(item.date, item.endTime, tzOffsetMinutes)
      : allDay
        ? new Date(startAt.getTime() + 24 * 60 * 60_000)
        : new Date(startAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000);

    const event = await createEvent(userId, {
      title: item.title,
      description: item.description ?? undefined,
      location: item.location ?? undefined,
      startAt: startAt.toISOString(),
      endAt: (endAt > startAt
        ? endAt
        : new Date(startAt.getTime() + DEFAULT_EVENT_MINUTES * 60_000)
      ).toISOString(),
      allDay,
    });
    created.push(event);
  }
  return created;
}
