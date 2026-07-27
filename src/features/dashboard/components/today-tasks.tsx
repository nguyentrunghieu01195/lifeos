import { format, parseISO } from "date-fns";
import { ArrowRight, CircleCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isOverdue } from "@/features/tasks/lib/group";
import type { TodayTaskSummary } from "@/features/tasks/server/service";

/** Dashboard widget: what's due today (or slipped), straight from the database. */
export function TodayTasksCard({ summary }: { summary: TodayTaskSummary }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Today&apos;s tasks</CardTitle>
        <CardDescription>
          {summary.openCount === 0
            ? "Nothing open — enjoy the calm."
            : `${summary.openCount} open task${summary.openCount === 1 ? "" : "s"} in total`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary.dueTodayOrOverdue.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <CircleCheck aria-hidden className="size-4 text-emerald-500" />
            Nothing due today.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {summary.dueTodayOrOverdue.map((task) => (
              <li key={task.id} className="flex items-center gap-2 text-sm">
                <span className="truncate">{task.title}</span>
                {task.dueAt ? (
                  <Badge
                    variant={isOverdue(task) ? "destructive" : "outline"}
                    className="ml-auto shrink-0 text-[10px] font-normal"
                  >
                    {format(parseISO(task.dueAt), "MMM d")}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/tasks">
            Open tasks
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
