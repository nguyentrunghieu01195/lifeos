"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { Check, Circle, CircleCheck, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

import { TASKS_QUERY_KEY, useTaskMutations } from "../hooks";
import { createProjectAction, createSubtaskAction, createTagAction } from "../server/actions";
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type ProjectDto,
  type SubtaskDto,
  type TagDto,
  type TaskDto,
} from "../types";

const NO_PROJECT = "none";
const NO_RECURRENCE = "NONE";

const formSchema = z.object({
  title: z.string().trim().min(1, "Title is required.").max(200),
  description: z.string().max(4000),
  projectId: z.string(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  dueDate: z.string(),
  dueTime: z.string(),
  reminderDate: z.string(),
  reminderTime: z.string(),
  recurrenceFreq: z.enum([NO_RECURRENCE, "DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  recurrenceInterval: z.coerce.number().int().min(1).max(99),
});

type FormValues = z.infer<typeof formSchema>;

function toIso(date: string, time: string): string | null {
  if (!date) return null;
  return new Date(`${date}T${time || "09:00"}:00`).toISOString();
}

function splitIso(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const parsed = parseISO(iso);
  return { date: format(parsed, "yyyy-MM-dd"), time: format(parsed, "HH:mm") };
}

function defaultsFor(task: TaskDto | null): FormValues {
  const due = splitIso(task?.dueAt ?? null);
  const reminder = splitIso(task?.reminderAt ?? null);
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.projectId ?? NO_PROJECT,
    priority: task?.priority ?? "MEDIUM",
    status: task?.status ?? "TODO",
    dueDate: due.date,
    dueTime: due.time,
    reminderDate: reminder.date,
    reminderTime: reminder.time,
    recurrenceFreq: task?.recurrenceFreq ?? NO_RECURRENCE,
    recurrenceInterval: task?.recurrenceInterval ?? 1,
  };
}

interface TaskFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: TaskDto | null;
  projects: ProjectDto[];
  tags: TagDto[];
  onProjectsChange: (projects: ProjectDto[]) => void;
  onTagsChange: (tags: TagDto[]) => void;
}

export function TaskFormSheet({
  open,
  onOpenChange,
  task,
  projects,
  tags,
  onProjectsChange,
  onTagsChange,
}: TaskFormSheetProps) {
  const { create, update, remove, toggle } = useTaskMutations();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultsFor(task),
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<SubtaskDto[]>([]);
  const [newSubtask, setNewSubtask] = useState("");
  const [newProject, setNewProject] = useState("");
  const [newTag, setNewTag] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Re-seed the form whenever a different task is opened.
  useEffect(() => {
    if (open) {
      form.reset(defaultsFor(task));
      setSelectedTagIds(task?.tags.map((tag) => tag.id) ?? []);
      setSubtasks(task?.subtasks ?? []);
      setConfirmDelete(false);
      setNewSubtask("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id]);

  const editing = task !== null;
  const recurrence = form.watch("recurrenceFreq");
  const pending = create.isPending || update.isPending;

  const onSubmit = form.handleSubmit((values) => {
    const payload = {
      title: values.title,
      description: values.description || undefined,
      projectId: values.projectId === NO_PROJECT ? null : values.projectId,
      priority: values.priority,
      status: values.status,
      dueAt: toIso(values.dueDate, values.dueTime),
      reminderAt: toIso(values.reminderDate, values.reminderTime),
      recurrenceFreq: values.recurrenceFreq === NO_RECURRENCE ? null : values.recurrenceFreq,
      recurrenceInterval:
        values.recurrenceFreq === NO_RECURRENCE ? null : values.recurrenceInterval,
      tagIds: selectedTagIds,
    };

    if (editing && task) {
      update.mutate({ id: task.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  });

  const addProject = async () => {
    const name = newProject.trim();
    if (!name) return;
    const result = await createProjectAction({ name });
    if (result.ok) {
      onProjectsChange([...projects, result.data]);
      form.setValue("projectId", result.data.id);
      setNewProject("");
    } else {
      toast.error(result.error);
    }
  };

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    const result = await createTagAction({ name });
    if (result.ok) {
      onTagsChange([...tags, result.data]);
      setSelectedTagIds((ids) => [...ids, result.data.id]);
      setNewTag("");
    } else {
      toast.error(result.error);
    }
  };

  const addSubtask = async () => {
    const title = newSubtask.trim();
    if (!title || !task) return;
    const result = await createSubtaskAction({ parentId: task.id, title });
    if (result.ok) {
      setSubtasks((list) => [...list, { id: result.data.id, title, status: "TODO" }]);
      setNewSubtask("");
      void queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY });
    } else {
      toast.error(result.error);
    }
  };

  const toggleSubtask = (id: string) => {
    setSubtasks((list) =>
      list.map((subtask) =>
        subtask.id === id
          ? { ...subtask, status: subtask.status === "DONE" ? "TODO" : "DONE" }
          : subtask,
      ),
    );
    toggle.mutate(id);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{editing ? "Edit task" : "New task"}</SheetTitle>
          <SheetDescription>
            {editing ? "Update the details of this task." : "Capture what needs to get done."}
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
                    <Input placeholder="What needs doing?" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea rows={3} placeholder="Details, links, context…" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priority</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="projectId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Project</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>No project</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input
                      value={newProject}
                      onChange={(event) => setNewProject(event.target.value)}
                      placeholder="New project name"
                      className="h-8 text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void addProject()}
                      disabled={!newProject.trim()}
                    >
                      <Plus aria-hidden />
                      Add
                    </Button>
                  </div>
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="dueDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="reminderDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reminderTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reminder time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="recurrenceFreq"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Repeats</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_RECURRENCE}>Never</SelectItem>
                        <SelectItem value="DAILY">Daily</SelectItem>
                        <SelectItem value="WEEKLY">Weekly</SelectItem>
                        <SelectItem value="MONTHLY">Monthly</SelectItem>
                        <SelectItem value="YEARLY">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              {recurrence !== NO_RECURRENCE ? (
                <FormField
                  control={form.control}
                  name="recurrenceInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Every N</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={99} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        setSelectedTagIds((ids) =>
                          selected ? ids.filter((id) => id !== tag.id) : [...ids, tag.id],
                        )
                      }
                    >
                      <Badge
                        variant={selected ? "default" : "outline"}
                        className={cn("gap-1", !selected && "text-muted-foreground")}
                      >
                        {selected ? <Check aria-hidden className="size-3" /> : null}
                        {tag.name}
                      </Badge>
                    </button>
                  );
                })}
                {tags.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tags yet.</p>
                ) : null}
              </div>
              <div className="mt-2 flex gap-2">
                <Input
                  value={newTag}
                  onChange={(event) => setNewTag(event.target.value)}
                  placeholder="New tag name"
                  className="h-8 text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void addTag()}
                  disabled={!newTag.trim()}
                >
                  <Plus aria-hidden />
                  Add
                </Button>
              </div>
            </div>

            {editing && task ? (
              <div>
                <p className="mb-2 text-sm font-medium">Subtasks</p>
                <div className="space-y-1">
                  {subtasks.map((subtask) => (
                    <div key={subtask.id} className="flex items-center gap-2 text-sm">
                      <button
                        type="button"
                        aria-label={
                          subtask.status === "DONE"
                            ? `Reopen "${subtask.title}"`
                            : `Complete "${subtask.title}"`
                        }
                        onClick={() => toggleSubtask(subtask.id)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {subtask.status === "DONE" ? (
                          <CircleCheck aria-hidden className="size-4 text-emerald-500" />
                        ) : (
                          <Circle aria-hidden className="size-4" />
                        )}
                      </button>
                      <span
                        className={cn(
                          subtask.status === "DONE" && "text-muted-foreground line-through",
                        )}
                      >
                        {subtask.title}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input
                    value={newSubtask}
                    onChange={(event) => setNewSubtask(event.target.value)}
                    placeholder="Add a subtask"
                    className="h-8 text-sm"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void addSubtask();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void addSubtask()}
                    disabled={!newSubtask.trim()}
                  >
                    <Plus aria-hidden />
                    Add
                  </Button>
                </div>
              </div>
            ) : null}

            <SheetFooter className="flex-row items-center gap-2 px-0">
              {editing && task ? (
                <Button
                  type="button"
                  variant={confirmDelete ? "destructive" : "outline"}
                  onClick={() => {
                    if (!confirmDelete) {
                      setConfirmDelete(true);
                      return;
                    }
                    remove.mutate(task.id, { onSuccess: () => onOpenChange(false) });
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
                  {editing ? "Save changes" : "Create task"}
                </Button>
              </div>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
