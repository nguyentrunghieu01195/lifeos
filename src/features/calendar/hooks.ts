"use client";

import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { ActionResult } from "@/types/actions";

import type { CreateEventInput, MoveEventInput, UpdateEventInput } from "./schemas";
import {
  createEventAction,
  deleteEventAction,
  moveEventAction,
  scheduleWithAIAction,
  updateEventAction,
} from "./server/actions";
import type { CalendarDataDto, EventDto } from "./types";

/** Range-keyed calendar data with optimistic event mutations. */

export function calendarQueryKey(from: Date, to: Date) {
  return ["calendar", from.toISOString(), to.toISOString()] as const;
}

async function fetchCalendarData(from: Date, to: Date): Promise<CalendarDataDto> {
  const params = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  const response = await fetch(`/api/calendar?${params.toString()}`);
  if (!response.ok) {
    throw new Error("Failed to load calendar.");
  }
  return (await response.json()) as CalendarDataDto;
}

async function unwrap<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise;
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.data;
}

export function useCalendarData(from: Date, to: Date, initialData?: CalendarDataDto) {
  return useQuery({
    queryKey: calendarQueryKey(from, to),
    queryFn: () => fetchCalendarData(from, to),
    ...(initialData ? { initialData } : {}),
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  });
}

interface MutationContext {
  previous: Array<[readonly unknown[], CalendarDataDto | undefined]>;
}

async function patchAllRanges(
  queryClient: QueryClient,
  patch: (data: CalendarDataDto) => CalendarDataDto,
): Promise<MutationContext["previous"]> {
  await queryClient.cancelQueries({ queryKey: ["calendar"] });
  const entries = queryClient.getQueriesData<CalendarDataDto>({ queryKey: ["calendar"] });
  for (const [key, data] of entries) {
    if (data) {
      queryClient.setQueryData(key, patch(data));
    }
  }
  return entries;
}

export function useEventMutations() {
  const queryClient = useQueryClient();

  const rollback = (error: Error, _variables: unknown, context: MutationContext | undefined) => {
    for (const [key, data] of context?.previous ?? []) {
      queryClient.setQueryData(key, data);
    }
    toast.error(error.message);
  };

  const settle = () => {
    void queryClient.invalidateQueries({ queryKey: ["calendar"] });
  };

  const create = useMutation({
    mutationFn: (input: CreateEventInput) => unwrap(createEventAction(input)),
    onMutate: async (input): Promise<MutationContext> => {
      const optimistic: EventDto = {
        id: `tmp_${Date.now()}`,
        title: input.title,
        description: input.description ?? null,
        location: input.location ?? null,
        startAt: input.startAt,
        endAt: input.endAt,
        allDay: input.allDay ?? false,
        color: input.color ?? "#6366f1",
        source: "LOCAL",
        createdAt: new Date().toISOString(),
      };
      return {
        previous: await patchAllRanges(queryClient, (data) => ({
          ...data,
          events: [...data.events, optimistic],
        })),
      };
    },
    onError: rollback,
    onSettled: settle,
  });

  const update = useMutation({
    mutationFn: (input: UpdateEventInput) => unwrap(updateEventAction(input)),
    onMutate: async (input): Promise<MutationContext> => ({
      previous: await patchAllRanges(queryClient, (data) => ({
        ...data,
        events: data.events.map((event) =>
          event.id === input.id
            ? {
                ...event,
                ...(input.title !== undefined ? { title: input.title } : {}),
                ...(input.startAt !== undefined ? { startAt: input.startAt } : {}),
                ...(input.endAt !== undefined ? { endAt: input.endAt } : {}),
                ...(input.allDay !== undefined ? { allDay: input.allDay } : {}),
                ...(input.color !== undefined ? { color: input.color } : {}),
              }
            : event,
        ),
      })),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const move = useMutation({
    mutationFn: (input: MoveEventInput) => unwrap(moveEventAction(input)),
    onMutate: async (input): Promise<MutationContext> => ({
      previous: await patchAllRanges(queryClient, (data) => ({
        ...data,
        events: data.events.map((event) =>
          event.id === input.id ? { ...event, startAt: input.startAt, endAt: input.endAt } : event,
        ),
      })),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteEventAction(id)),
    onMutate: async (id): Promise<MutationContext> => ({
      previous: await patchAllRanges(queryClient, (data) => ({
        ...data,
        events: data.events.filter((event) => event.id !== id),
      })),
    }),
    onError: rollback,
    onSettled: settle,
  });

  const schedule = useMutation({
    mutationFn: (input: { prompt: string; todayDate: string; tzOffsetMinutes: number }) =>
      unwrap(scheduleWithAIAction(input)),
    onSuccess: (events) => {
      toast.success(`Scheduled ${events.length} event${events.length === 1 ? "" : "s"} with AI.`);
    },
    onSettled: settle,
  });

  return { create, update, move, remove, schedule };
}
