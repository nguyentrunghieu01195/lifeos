import { ArrowRight, Flame } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface TodayHabitsCardProps {
  total: number;
  done: number;
  habits: Array<{ id: string; name: string; icon: string; color: string; done: boolean }>;
}

/** Dashboard widget: today's habit progress. */
export function TodayHabitsCard({ total, done, habits }: TodayHabitsCardProps) {
  const empty = total === 0;
  const allDone = total > 0 && done === total;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Today&apos;s habits
          {allDone ? <Flame aria-hidden className="size-4 text-amber-500" /> : null}
        </CardTitle>
        <CardDescription>
          {empty
            ? "No habits yet."
            : allDone
              ? "All done — great day!"
              : `${done} of ${total} done.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flame aria-hidden className="size-4" />
            Add your first habit to start tracking.
          </p>
        ) : (
          <>
            {/* Progress bar */}
            <div
              role="progressbar"
              aria-label="Today's habit progress"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={done}
              className="h-2 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${(done / total) * 100}%`,
                  backgroundColor: allDone ? "#f59e0b" : "#6366f1",
                }}
              />
            </div>

            <ul className="space-y-1.5">
              {habits.slice(0, 5).map((habit) => (
                <li key={habit.id} className="flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className={cn("size-2.5 shrink-0 rounded-full", !habit.done && "opacity-30")}
                    style={{ backgroundColor: habit.color }}
                  />
                  <span className={cn("truncate", !habit.done && "text-muted-foreground")}>
                    {habit.icon} {habit.name}
                  </span>
                  {habit.done ? (
                    <Flame aria-hidden className="ml-auto size-3.5 shrink-0 text-amber-500" />
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/habits">
            Open habits
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
