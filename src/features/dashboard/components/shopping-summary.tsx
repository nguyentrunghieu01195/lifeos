import { ArrowRight, ShoppingCart } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ShoppingDashboardDto } from "@/features/shopping/types";

/** Dashboard widget: active shopping lists with progress. */
export function ShoppingSummaryCard({ data }: { data: ShoppingDashboardDto }) {
  const empty = data.lists.length === 0;

  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Shopping lists</CardTitle>
        <CardDescription>
          {empty ? "No active lists." : "Your active lists at a glance."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {empty ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShoppingCart aria-hidden className="size-4" />
            Create a list to start tracking your shopping.
          </p>
        ) : (
          <ul className="space-y-2">
            {data.lists.map((list) => {
              const done = list.totalItems > 0 && list.checkedItems === list.totalItems;
              const pct = list.totalItems > 0 ? (list.checkedItems / list.totalItems) * 100 : 0;

              return (
                <li key={list.id}>
                  <Link href={`/shopping/${list.id}`} className="block">
                    <div className="flex items-center justify-between text-sm">
                      <span
                        className={cn(
                          "truncate font-medium",
                          done && "text-muted-foreground line-through",
                        )}
                      >
                        {list.name}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground tabular-nums">
                        {list.checkedItems}/{list.totalItems}
                      </span>
                    </div>
                    {list.totalItems > 0 ? (
                      <div
                        role="progressbar"
                        aria-label={`${list.name} progress`}
                        aria-valuenow={Math.round(pct)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: done ? "#10b981" : "#6366f1",
                          }}
                        />
                      </div>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/shopping">
            Open shopping
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
