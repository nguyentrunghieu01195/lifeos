"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  addMilliseconds,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
} from "date-fns";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

import type { MoveEventInput } from "../schemas";
import type { EventDto, TaskCalendarItemDto } from "../types";
import { EventChip, TaskChip } from "./event-chip";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_PER_DAY = 3;

interface MonthGridProps {
  from: Date;
  to: Date;
  cursor: Date;
  events: EventDto[];
  tasks: TaskCalendarItemDto[];
  onEdit: (event: EventDto) => void;
  onMove: (input: MoveEventInput) => void;
  onCreateAt: (start: Date) => void;
}

/** Month view: events are draggable across days (time of day is preserved). */
export function MonthGrid({
  from,
  to,
  cursor,
  events,
  tasks,
  onEdit,
  onMove,
  onCreateAt,
}: MonthGridProps) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [activeEvent, setActiveEvent] = useState<EventDto | null>(null);
  const today = new Date();

  const days = useMemo(() => eachDayOfInterval({ start: from, end: to }), [from, to]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, EventDto[]>();
    for (const event of events) {
      const key = format(parseISO(event.startAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), event]);
    }
    return map;
  }, [events]);

  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskCalendarItemDto[]>();
    for (const task of tasks) {
      const key = format(parseISO(task.dueAt), "yyyy-MM-dd");
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    return map;
  }, [tasks]);

  const handleDragStart = (dragEvent: DragStartEvent) => {
    setActiveEvent(events.find((event) => event.id === String(dragEvent.active.id)) ?? null);
  };

  const handleDragEnd = (dragEvent: DragEndEvent) => {
    setActiveEvent(null);
    const { active, over } = dragEvent;
    if (!over) return;

    const event = events.find((candidate) => candidate.id === String(active.id));
    if (!event) return;

    const targetDay = parseISO(`${String(over.id)}T00:00:00`);
    const start = parseISO(event.startAt);
    const dayDelta = differenceInCalendarDays(targetDay, start);
    if (dayDelta === 0) return;

    const deltaMs = dayDelta * 24 * 60 * 60_000;
    onMove({
      id: event.id,
      startAt: addMilliseconds(start, deltaMs).toISOString(),
      endAt: addMilliseconds(parseISO(event.endAt), deltaMs).toISOString(),
    });
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveEvent(null)}
    >
      <div className="grid grid-cols-7 overflow-hidden rounded-xl border">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="border-b bg-muted/40 px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}
        {days.map((day) => (
          <DayCell
            key={format(day, "yyyy-MM-dd")}
            day={day}
            inMonth={isSameMonth(day, cursor)}
            isToday={isSameDay(day, today)}
            events={eventsByDay.get(format(day, "yyyy-MM-dd")) ?? []}
            tasks={tasksByDay.get(format(day, "yyyy-MM-dd")) ?? []}
            onEdit={onEdit}
            onCreateAt={onCreateAt}
          />
        ))}
      </div>
      <DragOverlay>
        {activeEvent ? (
          <div className="w-40">
            <EventChip event={activeEvent} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function DayCell({
  day,
  inMonth,
  isToday,
  events,
  tasks,
  onEdit,
  onCreateAt,
}: {
  day: Date;
  inMonth: boolean;
  isToday: boolean;
  events: EventDto[];
  tasks: TaskCalendarItemDto[];
  onEdit: (event: EventDto) => void;
  onCreateAt: (start: Date) => void;
}) {
  const key = format(day, "yyyy-MM-dd");
  const { setNodeRef, isOver } = useDroppable({ id: key });
  const overflow = events.length + tasks.length - MAX_PER_DAY;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-28 border-t border-r p-1.5 transition-colors [&:nth-child(7n+8)]:border-l-0",
        !inMonth && "bg-muted/20",
        isOver && "bg-accent/70",
      )}
      onDoubleClick={() => {
        const start = new Date(day);
        start.setHours(9, 0, 0, 0);
        onCreateAt(start);
      }}
    >
      <span
        className={cn(
          "inline-flex size-6 items-center justify-center rounded-full text-xs",
          !inMonth && "text-muted-foreground/60",
          isToday && "bg-primary font-semibold text-primary-foreground",
        )}
      >
        {format(day, "d")}
      </span>
      <div className="mt-1 space-y-1">
        {events.slice(0, MAX_PER_DAY).map((event) => (
          <DraggableChip key={event.id} event={event} onEdit={onEdit} />
        ))}
        {tasks.slice(0, Math.max(0, MAX_PER_DAY - events.length)).map((task) => (
          <TaskChip key={task.id} task={task} />
        ))}
        {overflow > 0 ? (
          <p className="px-1 text-[10px] text-muted-foreground">+{overflow} more</p>
        ) : null}
      </div>
    </div>
  );
}

function DraggableChip({ event, onEdit }: { event: EventDto; onEdit: (event: EventDto) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: event.id });

  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")} {...attributes} {...listeners}>
      <EventChip event={event} onClick={() => onEdit(event)} />
    </div>
  );
}
