"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, parseISO } from "date-fns";
import { Pencil } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { isOverdue } from "../lib/group";
import { positionBetween } from "../lib/position";
import type { MoveTaskInput } from "../schemas";
import { TASK_STATUS_LABELS, TASK_STATUSES, type TaskDto, type TaskStatus } from "../types";
import { PRIORITY_DOT } from "./task-item";

interface TaskBoardProps {
  tasks: TaskDto[];
  onMove: (input: MoveTaskInput) => void;
  onEdit: (task: TaskDto) => void;
}

/** Kanban board: three status columns with accessible drag-and-drop. */
export function TaskBoard({ tasks, onMove, onEdit }: TaskBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);

  const columns = useMemo(() => {
    const byStatus: Record<TaskStatus, TaskDto[]> = { TODO: [], IN_PROGRESS: [], DONE: [] };
    for (const task of [...tasks].sort((a, b) => a.position - b.position)) {
      byStatus[task.status].push(task);
    }
    return byStatus;
  }, [tasks]);

  const findTask = (id: string) => tasks.find((task) => task.id === id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(findTask(String(event.active.id)) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = findTask(String(active.id));
    if (!task) return;

    const overId = String(over.id);
    let targetStatus: TaskStatus;
    let targetIndex: number;

    if (TASK_STATUSES.includes(overId as TaskStatus)) {
      // Dropped on an empty column area — append at the end.
      targetStatus = overId as TaskStatus;
      targetIndex = columns[targetStatus].filter((t) => t.id !== task.id).length;
    } else {
      const overTask = findTask(overId);
      if (!overTask || overTask.id === task.id) return;
      targetStatus = overTask.status;
      const column = columns[targetStatus].filter((t) => t.id !== task.id);
      targetIndex = column.findIndex((t) => t.id === overTask.id);
      if (targetIndex === -1) targetIndex = column.length;
    }

    const column = columns[targetStatus].filter((t) => t.id !== task.id);
    const before = column[targetIndex - 1]?.position ?? null;
    const after = column[targetIndex]?.position ?? null;
    const position = positionBetween(before, after);

    if (task.status === targetStatus && task.position === position) return;
    onMove({ id: task.id, status: targetStatus, position });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveTask(null)}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {TASK_STATUSES.map((status) => (
          <BoardColumn key={status} status={status} tasks={columns[status]} onEdit={onEdit} />
        ))}
      </div>
      <DragOverlay>
        {activeTask ? <BoardCard task={activeTask} onEdit={() => undefined} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function BoardColumn({
  status,
  tasks,
  onEdit,
}: {
  status: TaskStatus;
  tasks: TaskDto[];
  onEdit: (task: TaskDto) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      aria-label={TASK_STATUS_LABELS[status]}
      className={cn(
        "flex min-h-64 flex-col rounded-xl border bg-muted/40 p-2 transition-colors",
        isOver && "border-primary/40 bg-accent/60",
      )}
    >
      <h3 className="flex items-center justify-between px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {TASK_STATUS_LABELS[status]}
        <span>{tasks.length}</span>
      </h3>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex flex-1 flex-col gap-2 pt-1">
          {tasks.map((task) => (
            <SortableBoardCard key={task.id} task={task} onEdit={onEdit} />
          ))}
          {tasks.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground/70">
              Drop tasks here
            </p>
          ) : null}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableBoardCard({ task, onEdit }: { task: TaskDto; onEdit: (task: TaskDto) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
    >
      <BoardCard task={task} onEdit={onEdit} />
    </div>
  );
}

function BoardCard({
  task,
  onEdit,
  overlay = false,
}: {
  task: TaskDto;
  onEdit: (task: TaskDto) => void;
  overlay?: boolean;
}) {
  const overdue = isOverdue(task);

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card p-3 text-sm shadow-xs",
        overlay && "shadow-lg",
        task.status === "DONE" && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={cn(
            "min-w-0 font-medium break-words",
            task.status === "DONE" && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </p>
        {!overlay ? (
          <Button
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            aria-label={`Edit "${task.title}"`}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(task);
            }}
          >
            <Pencil aria-hidden className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", PRIORITY_DOT[task.priority])}
          title={task.priority}
        />
        {task.dueAt ? (
          <Badge variant={overdue ? "destructive" : "outline"} className="text-[10px] font-normal">
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
      </div>
    </div>
  );
}
