"use client";

import {
  ArrowLeft,
  Check,
  Loader2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import { formatPrice, formatQty } from "../lib/format";
import {
  addItemAction,
  archiveListAction,
  bulkAddItemsAction,
  deleteItemAction,
  resetListAction,
  suggestItemsAction,
  toggleItemAction,
} from "../server/actions";
import type { ItemSuggestionDto, ShoppingItemDto, ShoppingListDetailDto } from "../types";

export function ShoppingListView({ list }: { list: ShoppingListDetailDto }) {
  const router = useRouter();

  const [checkedIds, setCheckedIds] = useState<Set<string>>(
    new Set(list.items.filter((i) => i.isChecked).map((i) => i.id)),
  );
  const [items, setItems] = useState<ShoppingItemDto[]>(list.items);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [archiveArmed, setArchiveArmed] = useState(false);
  const [archiveTimer, setArchiveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<ItemSuggestionDto[]>([]);
  const [selectedNames, setSelectedNames] = useState<Set<string>>(new Set());

  const toggle = async (itemId: string) => {
    const wasChecked = checkedIds.has(itemId);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (wasChecked) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
    const result = await toggleItemAction(itemId);
    if (!result.ok) {
      setCheckedIds((prev) => {
        const next = new Set(prev);
        if (wasChecked) {
          next.add(itemId);
        } else {
          next.delete(itemId);
        }
        return next;
      });
      toast.error(result.error);
    } else {
      router.refresh();
    }
  };

  const quickAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    const optimistic: ShoppingItemDto = {
      id: `opt-${Date.now()}`,
      listId: list.id,
      name,
      quantity: 1,
      unit: "",
      priceMinor: null,
      isChecked: false,
      sortOrder: items.length,
    };
    setItems((prev) => [...prev, optimistic]);
    setNewName("");
    const result = await addItemAction({
      listId: list.id,
      name,
      quantity: 1,
      unit: "",
      priceMinor: null,
    });
    setAdding(false);
    if (result.ok) {
      setItems((prev) => prev.map((i) => (i.id === optimistic.id ? result.data : i)));
      router.refresh();
    } else {
      setItems((prev) => prev.filter((i) => i.id !== optimistic.id));
      setNewName(name);
      toast.error(result.error);
    }
  };

  const removeItem = async (itemId: string) => {
    const previous = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));
    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.delete(itemId);
      return next;
    });
    const result = await deleteItemAction(itemId);
    if (!result.ok) {
      setItems(previous);
      toast.error(result.error);
    } else {
      router.refresh();
    }
  };

  const resetList = async () => {
    setCheckedIds(new Set());
    const result = await resetListAction(list.id);
    if (!result.ok) {
      setCheckedIds(new Set(list.items.filter((i) => i.isChecked).map((i) => i.id)));
      toast.error(result.error);
    } else {
      router.refresh();
    }
  };

  const archiveList = async () => {
    if (!archiveArmed) {
      setArchiveArmed(true);
      if (archiveTimer) clearTimeout(archiveTimer);
      setArchiveTimer(setTimeout(() => setArchiveArmed(false), 3000));
      return;
    }
    const result = await archiveListAction(list.id);
    if (result.ok) {
      router.push("/shopping");
    } else {
      toast.error(result.error);
      setArchiveArmed(false);
    }
  };

  const runAiSuggest = async () => {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    const result = await suggestItemsAction({ listId: list.id, prompt: aiPrompt });
    setAiBusy(false);
    if (result.ok) {
      setSuggestions(result.data);
      setSelectedNames(new Set(result.data.map((s) => s.name)));
    } else {
      toast.error(result.error);
    }
  };

  const applyAiSuggestions = async () => {
    const toAdd = suggestions.filter((s) => selectedNames.has(s.name));
    if (toAdd.length === 0) {
      setAiOpen(false);
      return;
    }
    setAiBusy(true);
    const result = await bulkAddItemsAction({ listId: list.id, items: toAdd });
    setAiBusy(false);
    if (result.ok) {
      setAiOpen(false);
      setSuggestions([]);
      setAiPrompt("");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const unchecked = items.filter((i) => !checkedIds.has(i.id));
  const checked = items.filter((i) => checkedIds.has(i.id));
  const runningTotal = unchecked
    .filter((i) => i.priceMinor !== null)
    .reduce((acc, i) => acc + i.priceMinor! * i.quantity, 0);
  const hasPrice = unchecked.some((i) => i.priceMinor !== null);

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/shopping">
            <ArrowLeft aria-hidden />
            Lists
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-lg font-semibold">{list.name}</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAiOpen(true)}
          aria-label="AI suggest items"
        >
          <Sparkles aria-hidden />
          AI suggest
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label="List options">
              <MoreHorizontal aria-hidden className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => void resetList()} disabled={checkedIds.size === 0}>
              <RotateCcw aria-hidden />
              Reset (uncheck all)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => void archiveList()}>
              <Trash2 aria-hidden />
              {archiveArmed ? "Confirm archive" : "Archive list"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {items.length > 0 ? (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{checkedIds.size}</span>
            {" of "}
            <span className="font-medium text-foreground tabular-nums">{items.length}</span>
            {" items"}
          </span>
          {hasPrice && runningTotal > 0 ? (
            <span className="ml-auto text-xs text-muted-foreground">
              Remaining: {formatPrice(Math.round(runningTotal))}
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && void quickAdd()}
          placeholder="Add item…"
          aria-label="New item name"
          className="flex-1"
          maxLength={100}
        />
        <Button onClick={() => void quickAdd()} disabled={adding || !newName.trim()} size="sm">
          {adding ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}Add
        </Button>
      </div>

      {unchecked.length === 0 && checked.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          <p>Type something above to add your first item.</p>
        </div>
      ) : (
        <>
          {unchecked.length > 0 ? (
            <Card className="glass">
              <CardContent className="divide-y px-0 py-0">
                {unchecked.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    checked={false}
                    onToggle={() => void toggle(item.id)}
                    onDelete={() => void removeItem(item.id)}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
          {checked.length > 0 ? (
            <div>
              <p className="mb-1.5 ml-1 text-xs font-medium text-muted-foreground">
                Checked ({checked.length})
              </p>
              <Card className="glass opacity-70">
                <CardContent className="divide-y px-0 py-0">
                  {checked.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      checked={true}
                      onToggle={() => void toggle(item.id)}
                      onDelete={() => void removeItem(item.id)}
                    />
                  ))}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </>
      )}

      <Dialog
        open={aiOpen}
        onOpenChange={(open) => {
          if (!open) {
            setSuggestions([]);
            setAiPrompt("");
          }
          setAiOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>AI item suggestions</DialogTitle>
            <DialogDescription>Describe what you&apos;re making or buying.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ai-prompt">What are you shopping for?</Label>
            <Textarea
              id="ai-prompt"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. bữa tối gia đình 4 người, nấu phở bò"
              rows={2}
              maxLength={300}
              aria-label="AI shopping prompt"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runAiSuggest()}
              disabled={aiBusy || !aiPrompt.trim()}
            >
              {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : <Sparkles aria-hidden />}
              Suggest
            </Button>
          </div>
          {suggestions.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Select items ({selectedNames.size}/{suggestions.length}):
              </p>
              <ul className="max-h-60 space-y-1.5 overflow-y-auto">
                {suggestions.map((s) => (
                  <li key={s.name} className="flex items-center gap-2">
                    <Checkbox
                      id={`s-${s.name}`}
                      checked={selectedNames.has(s.name)}
                      onCheckedChange={(c) =>
                        setSelectedNames((prev) => {
                          const next = new Set(prev);
                          if (c) {
                            next.add(s.name);
                          } else {
                            next.delete(s.name);
                          }
                          return next;
                        })
                      }
                      aria-label={`Select ${s.name}`}
                    />
                    <label htmlFor={`s-${s.name}`} className="flex-1 cursor-pointer text-sm">
                      {s.name}
                      {s.unit || s.quantity !== 1 ? (
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          {formatQty(s.quantity)}
                          {s.unit ? ` ${s.unit}` : ""}
                        </span>
                      ) : null}
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            {suggestions.length > 0 ? (
              <Button
                onClick={() => void applyAiSuggestions()}
                disabled={aiBusy || selectedNames.size === 0}
              >
                {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                Add {selectedNames.size} item{selectedNames.size === 1 ? "" : "s"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemRow({
  item,
  checked,
  onToggle,
  onDelete,
}: {
  item: ShoppingItemDto;
  checked: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <Checkbox
        checked={checked}
        onCheckedChange={onToggle}
        aria-label={`Toggle ${item.name}`}
        className="shrink-0"
      />
      <div className="min-w-0 flex-1">
        <span className={cn("text-sm", checked && "text-muted-foreground line-through")}>
          {item.name}
        </span>
        {item.quantity !== 1 || item.unit ? (
          <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
            {formatQty(item.quantity)}
            {item.unit ? ` ${item.unit}` : ""}
          </span>
        ) : null}
      </div>
      {item.priceMinor !== null ? (
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
          {formatPrice(item.priceMinor)}
        </Badge>
      ) : null}
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onDelete}
        aria-label={`Remove ${item.name}`}
      >
        <X aria-hidden className="size-3.5" />
      </Button>
    </div>
  );
}
