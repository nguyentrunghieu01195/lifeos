"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

import { groupTasks } from "../lib/group";
import type { TaskDto } from "../types";
import { TaskItem } from "./task-item";

interface TaskListProps {
  tasks: TaskDto[];
  onToggle: (id: string) => void;
  onEdit: (task: TaskDto) => void;
  onDelete: (id: string) => void;
}

const SECTIONS = [
  ["overdue", "Overdue"],
  ["today", "Today"],
  ["upcoming", "Upcoming"],
  ["someday", "Someday"],
] as const;

export function TaskList({ tasks, onToggle, onEdit, onDelete }: TaskListProps) {
  const groups = groupTasks(tasks);
  const [showDone, setShowDone] = useState(false);
  const openCount = tasks.length - groups.done.length;

  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        No tasks yet — add your first one above, or let the AI plan something for you.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {openCount === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          All clear — every task is done. 🎉
        </div>
      ) : null}

      {SECTIONS.map(([key, label]) => {
        const sectionTasks = groups[key];
        if (sectionTasks.length === 0) return null;
        return (
          <section key={key} aria-label={label}>
            <h3 className="mb-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {label} · {sectionTasks.length}
            </h3>
            <div className="space-y-0.5">
              {sectionTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}

      {groups.done.length > 0 ? (
        <section aria-label="Done">
          <button
            type="button"
            className="mb-1 flex items-center gap-1 px-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:text-foreground"
            onClick={() => setShowDone((value) => !value)}
          >
            {showDone ? (
              <ChevronDown aria-hidden className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden className="size-3.5" />
            )}
            Done · {groups.done.length}
          </button>
          {showDone ? (
            <div className="space-y-0.5">
              {groups.done.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={onToggle}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
