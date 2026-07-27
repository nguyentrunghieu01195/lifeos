"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { addHours, format, parseISO } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { useEventMutations } from "../hooks";
import { EVENT_COLORS, type EventDto } from "../types";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().max(4000),
  location: z.string().max(200),
  allDay: z.boolean(),
  startDate: z.string().min(1, "Start date is required."),
  startTime: z.string(),
  endDate: z.string().min(1, "End date is required."),
  endTime: z.string(),
  color: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

function toIso(date: string, time: string, fallbackTime: string): string {
  return new Date(`${date}T${time || fallbackTime}:00`).toISOString();
}

function defaultsFor(event: EventDto | null, createStart: Date | null): FormValues {
  if (event) {
    const start = parseISO(event.startAt);
    const end = parseISO(event.endAt);
    return {
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      allDay: event.allDay,
      startDate: format(start, "yyyy-MM-dd"),
      startTime: format(start, "HH:mm"),
      endDate: format(end, "yyyy-MM-dd"),
      endTime: format(end, "HH:mm"),
      color: event.color,
    };
  }
  const start = createStart ?? addHours(new Date(), 1);
  const end = addHours(start, 1);
  return {
    title: "",
    description: "",
    location: "",
    allDay: false,
    startDate: format(start, "yyyy-MM-dd"),
    startTime: format(start, "HH:mm"),
    endDate: format(end, "yyyy-MM-dd"),
    endTime: format(end, "HH:mm"),
    color: EVENT_COLORS[0],
  };
}

interface EventFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: EventDto | null;
  createStart: Date | null;
}

export function EventFormSheet({ open, onOpenChange, event, createStart }: EventFormSheetProps) {
  const { create, update, remove } = useEventMutations();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(event, createStart),
  });

  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(event, createStart));
      setConfirmDelete(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id, createStart?.getTime()]);

  const editing = event !== null;
  const allDay = form.watch("allDay");
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    const startAt = values.allDay
      ? toIso(values.startDate, "00:00", "00:00")
      : toIso(values.startDate, values.startTime, "09:00");
    const endAt = values.allDay
      ? toIso(values.endDate || values.startDate, "23:59", "23:59")
      : toIso(values.endDate || values.startDate, values.endTime, "10:00");

    if (new Date(endAt) <= new Date(startAt)) {
      form.setError("endTime", { type: "manual", message: "End must be after start." });
      return;
    }

    const payload = {
      title: values.title,
      description: values.description || undefined,
      location: values.location || undefined,
      startAt,
      endAt,
      allDay: values.allDay,
      color: values.color,
    };

    if (editing && event) {
      update.mutate({ id: event.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit event" : "New event"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update the details of this event." : "Put something on the calendar."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={onSubmit} noValidate className="flex-1 space-y-4 px-4 pb-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input placeholder="What's happening?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Where? (optional)" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="allDay"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center gap-2">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="!mt-0">All day</FormLabel>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!allDay ? (
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              ) : null}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {!allDay ? (
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End time</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Notes, links, agenda…" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <div className="flex gap-2">
                    {EVENT_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Color ${color}`}
                        aria-pressed={field.value === color}
                        onClick={() => field.onChange(color)}
                        className={cn(
                          "flex size-7 items-center justify-center rounded-full transition-transform",
                          field.value === color && "scale-110 ring-2 ring-offset-2",
                        )}
                        style={{ backgroundColor: color }}
                      >
                        {field.value === color ? (
                          <Check aria-hidden className="size-3.5 text-white" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                </FormItem>
              )}
            />

            <SheetFooter className="flex-row items-center gap-2 px-0">
              {editing && event ? (
                <Button
                  type="button"
                  variant={confirmDelete ? "destructive" : "outline"}
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    remove.mutate(event.id, { onSuccess: () => onOpenChange(false) });
                  }}
                >
                  {confirmDelete ? "Confirm delete" : "Delete"}
                </Button>
              ) : null}
              <div className="ml-auto flex gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={pending}>
                  {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
                  {editing ? "Save changes" : "Create event"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
