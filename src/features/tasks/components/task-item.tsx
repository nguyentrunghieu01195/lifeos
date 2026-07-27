"use client";

import { format, parseISO } from "date-fns";
import { Circle, CircleCheck, ListTree, MoreHorizontal, Repeat, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import { isOverdue } from "../lib/group";
import { TASK_PRIORITY_LABELS, type TaskDto } from "../types";

export const PRIORITY_DOT: Record<TaskDto["priority"], string> = {
  LOW: "bg-muted-foreground/50",
  MEDIUM: "bg-sky-500",
  HIGH: "bg-amber-500",
  URGENT: "bg-red-500",
};

interface TaskItemProps {
  task: TaskDto;
  onToggle: (id: string) => void;
  onEdit: (task: TaskDto) => void;
  onDelete: (id: string) => void;
}

export function TaskItem({ task, onToggle, onEdit, onDelete }: TaskItemProps) {
  const done = task.status === "DONE";
  const overdue = isOverdue(task);
  const openSubtasks = task.subtasks.filter((subtask) => subtask.status !== "DONE").length;

  return (
    <div className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-accent/50">
      <button
        type="button"
        aria-label={done ? `Reopen "${task.title}"` : `Complete "${task.title}"`}
        className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => onToggle(task.id)}
      >
        {done ? (
          <CircleCheck aria-hidden className="size-5 text-emerald-500" />
        ) : (
          <Circle aria-hidden className="size-5" />
        )}
      </button>

      <button
        type="button"
        className="min-w-0 flex-1 text-left"
        onClick={() => onEdit(task)}
        aria-label={`Edit "${task.title}"`}
      >
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            aria-hidden
            title={TASK_PRIORITY_LABELS[task.priority]}
            className={cn("size-2 shrink-0 rounded-full", PRIORITY_DOT[task.priority])}
          />
          <span
            className={cn("truncate font-medium", done && "text-muted-foreground line-through")}
          >
            {task.title}
          </span>
          {task.source === "AI" ? (
            <Sparkles aria-label="AI generated" className="size-3.5 shrink-0 text-primary" />
          ) : null}
          {task.recurrenceFreq ? (
            <Repeat aria-label="Recurring" className="size-3.5 shrink-0 text-muted-foreground" />
          ) : null}
        </span>

        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.dueAt ? (
            <Badge
              variant={overdue ? "destructive" : "outline"}
              className="text-[10px] font-normal"
            >
              {format(parseISO(task.dueAt), "MMM d")}
            </Badge>
          ) : null}
          {task.project ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: task.project.color }}
              />
              {task.project.name}
            </Badge>
          ) : null}
          {task.tags.map((tag) => (
            <Badge key={tag.id} variant="outline" className="gap-1 text-[10px] font-normal">
              <span
                aria-hidden
                className="size-2 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </Badge>
          ))}
          {task.subtasks.length > 0 ? (
            <Badge variant="outline" className="gap-1 text-[10px] font-normal">
              <ListTree aria-hidden className="size-3" />
              {task.subtasks.length - openSubtasks}/{task.subtasks.length}
            </Badge>
          ) : null}
        </span>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Actions for "${task.title}"`}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => onEdit(task)}>Edit</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task.id)}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
