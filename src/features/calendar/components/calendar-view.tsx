"use client";

import { endOfWeek, format, isSameDay, startOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useCalendarData, useEventMutations } from "../hooks";
import { CALENDAR_VIEWS, computeRange, stepCursor, type CalendarView } from "../lib/range";
import type { CalendarDataDto, EventDto } from "../types";
import { AgendaList } from "./agenda-list";
import { AiScheduleDialog } from "./ai-schedule-dialog";
import { EventFormSheet } from "./event-form-sheet";
import { MonthGrid } from "./month-grid";
import { TimeGrid } from "./time-grid";

interface CalendarViewRootProps {
  initialData: CalendarDataDto;
  /** ISO range the server used for the initial payload (month view of today). */
  initialFrom: string;
  initialTo: string;
}

function headerLabel(view: CalendarView, cursor: Date): string {
  switch (view) {
    case "month":
      return format(cursor, "MMMM yyyy");
    case "week": {
      const from = startOfWeek(cursor, { weekStartsOn: 1 });
      const to = endOfWeek(cursor, { weekStartsOn: 1 });
      return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
    }
    case "day":
      return format(cursor, "EEEE, MMMM d, yyyy");
    case "agenda":
      return `Next 30 days from ${format(cursor, "MMM d")}`;
  }
}

export function CalendarViewRoot({ initialData, initialFrom, initialTo }: CalendarViewRootProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewParam = searchParams.get("view");
  const view: CalendarView = CALENDAR_VIEWS.includes(viewParam as CalendarView)
    ? (viewParam as CalendarView)
    : "month";

  const [cursor, setCursor] = useState(() => new Date());
  const range = useMemo(() => computeRange(view, cursor), [view, cursor]);

  const isInitialRange =
    range.from.toISOString() === initialFrom && range.to.toISOString() === initialTo;
  const { data } = useCalendarData(range.from, range.to, isInitialRange ? initialData : undefined);

  const { move } = useEventMutations();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventDto | null>(null);
  const [createStart, setCreateStart] = useState<Date | null>(null);

  // /calendar?new=1 (command palette) opens the create sheet once.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingEvent(null);
      setCreateStart(null);
      setSheetOpen(true);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const events = data?.events ?? [];
  const tasks = data?.tasks ?? [];

  const openEditor = (event: EventDto) => {
    setEditingEvent(event);
    setCreateStart(null);
    setSheetOpen(true);
  };

  const openCreate = (start: Date | null) => {
    setEditingEvent(null);
    setCreateStart(start);
    setSheetOpen(true);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="min-w-48 text-lg font-semibold tracking-tight">
          {headerLabel(view, cursor)}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous"
            onClick={() => setCursor((value) => stepCursor(view, value, -1))}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCursor(new Date())}
            disabled={isSameDay(cursor, new Date())}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next"
            onClick={() => setCursor((value) => stepCursor(view, value, 1))}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <AiScheduleDialog />
          <Button onClick={() => openCreate(null)}>
            <Plus aria-hidden />
            New event
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={(next) => router.replace(`${pathname}?view=${next}`)}>
        <TabsList>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="day">Day</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
        </TabsList>
      </Tabs>

      {view === "month" ? (
        <MonthGrid
          from={range.from}
          to={range.to}
          cursor={cursor}
          events={events}
          tasks={tasks}
          onEdit={openEditor}
          onMove={(input) => move.mutate(input)}
          onCreateAt={(start) => openCreate(start)}
        />
      ) : null}
      {view === "week" || view === "day" ? (
        <TimeGrid
          from={range.from}
          to={range.to}
          events={events}
          tasks={tasks}
          onEdit={openEditor}
          onCreateAt={(start) => openCreate(start)}
        />
      ) : null}
      {view === "agenda" ? <AgendaList events={events} tasks={tasks} onEdit={openEditor} /> : null}

      <p className="text-xs text-muted-foreground">
        Tip: double-click a day (month) or click a time slot (week/day) to create an event there.
        Dashed chips are tasks due that day.
      </p>

      <EventFormSheet
        open={sheetOpen}
        onOpenChange={(next) => {
          setSheetOpen(next);
          if (!next) {
            setEditingEvent(null);
            setCreateStart(null);
          }
        }}
        event={editingEvent}
        createStart={createStart}
      />
    </div>
  );
}
