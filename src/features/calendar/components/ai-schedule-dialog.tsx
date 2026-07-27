"use client";

import { format } from "date-fns";
import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

import { useEventMutations } from "../hooks";

/** Natural-language scheduling through the AI gateway (timezone-aware). */
export function AiScheduleDialog() {
  const { schedule } = useEventMutations();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    schedule.mutate(
      {
        prompt,
        todayDate: format(new Date(), "yyyy-MM-dd"),
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      },
      {
        onSuccess: () => {
          setOpen(false);
          setPrompt("");
        },
        onError: (mutationError) => setError(mutationError.message),
      },
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setError(null);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Sparkles aria-hidden className="text-primary" />
          Schedule with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Schedule with AI</DialogTitle>
          <DialogDescription>
            Describe your plans in plain language — dates like &quot;next Tuesday&quot; resolve
            against your local calendar.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="e.g. Dentist next Tuesday at 3pm, gym Mon/Wed/Fri at 7am this week"
          aria-label="Describe what to schedule"
        />
        {error ? (
          <p
            role="alert"
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={schedule.isPending || prompt.trim().length < 3}>
            {schedule.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Schedule events
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
