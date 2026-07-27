"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useTaskMutations, useTasks } from "../hooks";
import type { ProjectDto, TagDto, TaskDto } from "../types";
import { AiGenerateDialog } from "./ai-generate-dialog";
import { TaskBoard } from "./task-board";
import { TaskCalendar } from "./task-calendar";
import { TaskFormSheet } from "./task-form-sheet";
import { TaskList } from "./task-list";

const VIEWS = ["list", "board", "calendar"] as const;
type View = (typeof VIEWS)[number];

interface TasksViewProps {
  initialTasks: TaskDto[];
  initialProjects: ProjectDto[];
  initialTags: TagDto[];
}

export function TasksView({ initialTasks, initialProjects, initialTags }: TasksViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: tasks = [] } = useTasks(initialTasks);
  const { create, toggle, move, remove } = useTaskMutations();

  const [projects, setProjects] = useState(initialProjects);
  const [tags, setTags] = useState(initialTags);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskDto | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [search, setSearch] = useState("");

  const viewParam = searchParams.get("view");
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : "list";

  // /tasks?new=1 (command palette, dashboard) opens the create sheet once.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingTask(null);
      setSheetOpen(true);
      router.replace(pathname);
    }
  }, [searchParams, router, pathname]);

  const filtered = search.trim()
    ? tasks.filter((task) => task.title.toLowerCase().includes(search.trim().toLowerCase()))
    : tasks;

  const openEditor = (task: TaskDto | null) => {
    setEditingTask(task);
    setSheetOpen(true);
  };

  const quickAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const title = quickTitle.trim();
    if (!title) return;
    create.mutate({ title });
    setQuickTitle("");
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={quickAdd} className="min-w-56 flex-1">
          <Input
            value={quickTitle}
            onChange={(event) => setQuickTitle(event.target.value)}
            placeholder="Add a task — press Enter"
            aria-label="Quick add task"
          />
        </form>
        <AiGenerateDialog />
        <Button onClick={() => openEditor(null)}>
          <Plus aria-hidden />
          New task
        </Button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={view} onValueChange={(next) => router.replace(`${pathname}?view=${next}`)}>
          <TabsList>
            <TabsTrigger value="list">List</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Filter tasks…"
          aria-label="Filter tasks"
          className="w-56"
        />
      </div>

      {view === "list" ? (
        <TaskList
          tasks={filtered}
          onToggle={(id) => toggle.mutate(id)}
          onEdit={openEditor}
          onDelete={(id) => remove.mutate(id)}
        />
      ) : null}
      {view === "board" ? (
        <TaskBoard tasks={filtered} onMove={(input) => move.mutate(input)} onEdit={openEditor} />
      ) : null}
      {view === "calendar" ? <TaskCalendar tasks={filtered} onEdit={openEditor} /> : null}

      <TaskFormSheet
        open={sheetOpen}
        onOpenChange={(next) => {
          setSheetOpen(next);
          if (!next) setEditingTask(null);
        }}
        task={editingTask}
        projects={projects}
        tags={tags}
        onProjectsChange={setProjects}
        onTagsChange={setTags}
      />
    </div>
  );
}
