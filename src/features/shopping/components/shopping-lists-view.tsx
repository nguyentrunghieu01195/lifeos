"use client";

import { Check, Loader2, Plus, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { createListAction } from "../server/actions";
import type { ShoppingListDto } from "../types";

interface ShoppingListsViewProps {
  lists: ShoppingListDto[];
}

export function ShoppingListsView({ lists }: ShoppingListsViewProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  const submitCreate = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const result = await createListAction({ name: name.trim(), description: desc.trim() });
    setBusy(false);
    if (result.ok) {
      setCreating(false);
      setName("");
      setDesc("");
      router.push(`/shopping/${result.data.id}`);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus aria-hidden />
          New list
        </Button>
      </div>

      {lists.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <ShoppingCart aria-hidden className="size-6" />
          No shopping lists yet — create your first one.
        </div>
      ) : (
        <ul className="space-y-2">
          {lists.map((list) => {
            const done = list.totalItems > 0 && list.checkedItems === list.totalItems;
            const pct = list.totalItems > 0 ? (list.checkedItems / list.totalItems) * 100 : 0;

            return (
              <li key={list.id}>
                <button
                  type="button"
                  className="group w-full text-left"
                  onClick={() => router.push(`/shopping/${list.id}`)}
                  aria-label={`Open list ${list.name}`}
                >
                  <Card
                    className={cn(
                      "glass transition-shadow group-hover:shadow-md",
                      done && "border-emerald-500/30",
                    )}
                  >
                    <CardContent className="flex items-center gap-3 px-4 py-3">
                      <div
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full",
                          done
                            ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-muted",
                        )}
                      >
                        {done ? (
                          <Check aria-hidden className="size-5" />
                        ) : (
                          <ShoppingCart aria-hidden className="size-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{list.name}</p>
                        {list.description ? (
                          <p className="truncate text-xs text-muted-foreground">
                            {list.description}
                          </p>
                        ) : null}
                        {list.totalItems > 0 ? (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div
                              role="progressbar"
                              aria-label={`${list.name} progress`}
                              aria-valuenow={Math.round(pct)}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                            >
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  backgroundColor: done ? "#10b981" : "#6366f1",
                                }}
                              />
                            </div>
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {list.checkedItems}/{list.totalItems}
                            </span>
                          </div>
                        ) : (
                          <p className="mt-0.5 text-xs text-muted-foreground">Empty list</p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {done
                          ? "Done"
                          : list.totalItems - list.checkedItems === 0
                            ? "Empty"
                            : `${list.totalItems - list.checkedItems} left`}
                      </Badge>
                    </CardContent>
                  </Card>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={creating} onOpenChange={(open) => !open && setCreating(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New shopping list</DialogTitle>
            <DialogDescription>Give it a name — you can add items right after.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="space-y-1">
              <Label htmlFor="list-name">Name</Label>
              <Input
                id="list-name"
                autoFocus
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void submitCreate()}
                placeholder="e.g. Weekly groceries"
                maxLength={80}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="list-desc">Description (optional)</Label>
              <Input
                id="list-desc"
                value={desc}
                onChange={(event) => setDesc(event.target.value)}
                placeholder="e.g. For this week's meal plan"
                maxLength={200}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button onClick={() => void submitCreate()} disabled={busy || !name.trim()}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
