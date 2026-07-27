"use client";

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

import { useTaskMutations } from "../hooks";

/** Natural-language task planning through the AI gateway. */
export function AiGenerateDialog() {
  const { generate } = useTaskMutations();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    setError(null);
    generate.mutate(prompt, {
      onSuccess: () => {
        setOpen(false);
        setPrompt("");
      },
      onError: (mutationError) => setError(mutationError.message),
    });
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
          Plan with AI
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Plan with AI</DialogTitle>
          <DialogDescription>
            Describe what you want to get done — the assistant breaks it into tasks.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={4}
          placeholder="e.g. Prepare a housewarming party for 10 friends in two weeks"
          aria-label="Describe what to plan"
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
          <Button onClick={submit} disabled={generate.isPending || prompt.trim().length < 3}>
            {generate.isPending ? <Loader2 aria-hidden className="animate-spin" /> : null}
            Generate tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
