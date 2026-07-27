import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { TasksView } from "@/features/tasks/components/tasks-view";
import { listProjects, listTags, listTasks } from "@/features/tasks/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const [tasks, projects, tags] = await Promise.all([
    listTasks(userId),
    listProjects(userId),
    listTags(userId),
  ]);

  return <TasksView initialTasks={tasks} initialProjects={projects} initialTags={tags} />;
}
