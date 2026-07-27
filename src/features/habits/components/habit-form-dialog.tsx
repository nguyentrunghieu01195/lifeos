"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { createHabitAction, suggestHabitsAction, updateHabitAction } from "../server/actions";
import type { HabitDto, HabitFrequencyDto, HabitSuggestionDto, HabitWithStatsDto } from "../types";

const PALETTE = [
  "#6366f1",
  "#f97316",
  "#0ea5e9",
  "#22c55e",
  "#ec4899",
  "#eab308",
  "#ef4444",
  "#8b5cf6",
  "#10b981",
  "#64748b",
];

interface HabitFormDialogProps {
  open: boolean;
  editing: HabitWithStatsDto | null;
  onClose: () => void;
  onCreated?: (habit: HabitDto) => void;
}

interface FormState {
  name: string;
  icon: string;
  color: string;
  frequency: HabitFrequencyDto;
  targetCount: number;
}

export function HabitFormDialog({ open, editing, onClose, onCreated }: HabitFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        {open ? (
          <HabitForm
            key={editing?.id ?? "new"}
            editing={editing}
            onClose={onClose}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HabitForm({
  editing,
  onClose,
  onCreated,
}: {
  editing: HabitWithStatsDto | null;
  onClose: () => void;
  onCreated?: (habit: HabitDto) => void;
}) {
  const [form, setForm] = useState<FormState>({
    name: editing?.name ?? "",
    icon: editing?.icon ?? "✅",
    color: editing?.color ?? PALETTE[0]!,
    frequency: editing?.frequency ?? "DAILY",
    targetCount: editing?.targetCount ?? 3,
  });
  const [busy, setBusy] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiGoal, setAiGoal] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<HabitSuggestionDto[]>([]);

  const submit = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    let result;
    if (editing) {
      result = await updateHabitAction({ id: editing.id, ...form });
    } else {
      result = await createHabitAction(form);
    }
    setBusy(false);
    if (result.ok) {
      if (!editing && onCreated) onCreated(result.data as HabitDto);
      onClose();
    } else {
      toast.error(result.error);
    }
  };

  const runAiSuggest = async () => {
    if (!aiGoal.trim()) return;
    setAiBusy(true);
    const result = await suggestHabitsAction({ goal: aiGoal });
    setAiBusy(false);
    if (result.ok) {
      setSuggestions(result.data);
    } else {
      toast.error(result.error);
    }
  };

  const applySuggestion = (suggestion: HabitSuggestionDto) => {
    setForm({
      name: suggestion.name,
      icon: suggestion.icon,
      color: PALETTE[0]!,
      frequency: suggestion.frequency,
      targetCount: suggestion.targetCount,
    });
    setSuggestions([]);
    setShowAi(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{editing ? "Edit habit" : "New habit"}</DialogTitle>
        <DialogDescription>
          {editing ? "Update this habit's details." : "Track a new behavior you want to build."}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="space-y-1">
            <Label htmlFor="habit-icon">Icon</Label>
            <Input
              id="habit-icon"
              value={form.icon}
              onChange={(event) => setForm((state) => ({ ...state, icon: event.target.value }))}
              maxLength={8}
              className="w-16 text-center text-lg"
              aria-label="Habit icon emoji"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              autoFocus={!editing}
              value={form.name}
              onChange={(event) => setForm((state) => ({ ...state, name: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder="e.g. Read 20 pages"
              maxLength={60}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <div className="flex-1 space-y-1">
            <Label>Frequency</Label>
            <Select
              value={form.frequency}
              onValueChange={(value: HabitFrequencyDto) =>
                setForm((state) => ({ ...state, frequency: value }))
              }
            >
              <SelectTrigger aria-label="Frequency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {form.frequency === "WEEKLY" ? (
            <div className="w-32 space-y-1">
              <Label htmlFor="habit-target">Times/week</Label>
              <Input
                id="habit-target"
                type="number"
                min={1}
                max={7}
                value={form.targetCount}
                onChange={(event) =>
                  setForm((state) => ({
                    ...state,
                    targetCount: Math.min(7, Math.max(1, Number(event.target.value))),
                  }))
                }
              />
            </div>
          ) : null}
        </div>

        <div className="space-y-1">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((hex) => (
              <button
                key={hex}
                type="button"
                aria-label={`Color ${hex}`}
                aria-pressed={form.color === hex}
                onClick={() => setForm((state) => ({ ...state, color: hex }))}
                className="size-6 rounded-full transition-transform hover:scale-110 focus:ring-2 focus:ring-ring focus:outline-none"
                style={{
                  backgroundColor: hex,
                  outline: form.color === hex ? `3px solid ${hex}` : undefined,
                  outlineOffset: form.color === hex ? "2px" : undefined,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {!editing ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={() => setShowAi(!showAi)}
          >
            <Sparkles aria-hidden className="size-3.5" />
            {showAi ? "Hide AI suggestions" : "Get AI suggestions"}
          </Button>
          {showAi ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={aiGoal}
                onChange={(event) => setAiGoal(event.target.value)}
                placeholder="Describe your goal, e.g. 'I want to get healthier and reduce stress'"
                rows={2}
                maxLength={300}
                aria-label="Your goal for AI habit suggestions"
              />
              <Button
                variant="outline"
                size="sm"
                disabled={aiBusy || !aiGoal.trim()}
                onClick={() => void runAiSuggest()}
              >
                {aiBusy ? <Loader2 aria-hidden className="animate-spin" /> : null}
                Suggest habits
              </Button>
              {suggestions.length > 0 ? (
                <ul className="space-y-1.5">
                  {suggestions.map((suggestion, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        className="w-full rounded-lg border p-2.5 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => applySuggestion(suggestion)}
                        aria-label={`Use suggestion: ${suggestion.name}`}
                      >
                        <div className="font-medium">
                          {suggestion.icon} {suggestion.name}
                        </div>
                        <div className="text-xs text-muted-foreground">{suggestion.reason}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={() => void submit()} disabled={busy || !form.name.trim()}>
          {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
          {editing ? "Save" : "Create"}
        </Button>
      </DialogFooter>
    </>
  );
}
