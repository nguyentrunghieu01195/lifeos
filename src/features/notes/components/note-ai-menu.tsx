"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import { ArrowUpToLine, Check, Copy, Loader2, PenLine, ScrollText, Sparkles } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { rewriteTextAction, summarizeNoteAction } from "../server/actions";
import { REWRITE_TONES, type RewriteTone } from "../types";

const MIN_SUMMARY_CHARS = 40;
const MIN_REWRITE_CHARS = 10;
const MAX_REWRITE_CHARS = 4000;

interface NoteAiMenuProps {
  editor: Editor;
  noteId: string;
  /** Persists pending edits so the server sees the latest text before AI reads it. */
  flush: () => Promise<boolean>;
}

type AiResult =
  | { kind: "summary"; text: string }
  | { kind: "rewrite"; text: string; original: string; from: number; to: number };

/** Splits model output into paragraph nodes for insertion at the document top. */
function toParagraphNodes(text: string): object[] {
  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => ({
      type: "paragraph",
      content: [{ type: "text", text: block.replaceAll("\n", " ") }],
    }));
}

/** Builds inline content (text + hard breaks) to replace a selection in place. */
function toInlineNodes(text: string): object[] {
  const nodes: object[] = [];
  text.split("\n").forEach((line, index) => {
    if (index > 0) nodes.push({ type: "hardBreak" });
    if (line.length > 0) nodes.push({ type: "text", text: line });
  });
  return nodes.length > 0 ? nodes : [{ type: "text", text }];
}

export function NoteAiMenu({ editor, noteId, flush }: NoteAiMenuProps) {
  const [pending, setPending] = useState<"summary" | RewriteTone | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [copied, setCopied] = useState(false);

  const { textLength, selection } = useEditorState({
    editor,
    selector: (ctx) => {
      const { from, to } = ctx.editor.state.selection;
      return {
        textLength: ctx.editor.getText().trim().length,
        selection: {
          from,
          to,
          text: ctx.editor.state.doc.textBetween(from, to, "\n").trim(),
        },
      };
    },
  });

  const canSummarize = textLength >= MIN_SUMMARY_CHARS;
  const canRewrite =
    selection.text.length >= MIN_REWRITE_CHARS && selection.text.length <= MAX_REWRITE_CHARS;

  const summarize = async () => {
    setPending("summary");
    try {
      await flush();
      const response = await summarizeNoteAction(noteId);
      if (response.ok) {
        setResult({ kind: "summary", text: response.data.summary });
      } else {
        toast.error(response.error);
      }
    } finally {
      setPending(null);
    }
  };

  const rewrite = async (tone: RewriteTone) => {
    const captured = { ...selection };
    setPending(tone);
    try {
      const response = await rewriteTextAction({ text: captured.text, tone });
      if (response.ok) {
        setResult({
          kind: "rewrite",
          text: response.data.rewritten,
          original: captured.text,
          from: captured.from,
          to: captured.to,
        });
      } else {
        toast.error(response.error);
      }
    } finally {
      setPending(null);
    }
  };

  const copyResult = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const applyResult = () => {
    if (!result) return;
    if (result.kind === "summary") {
      editor
        .chain()
        .focus()
        .insertContentAt(0, [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Summary" }] },
          ...toParagraphNodes(result.text),
        ])
        .run();
    } else {
      editor
        .chain()
        .focus()
        .deleteRange({ from: result.from, to: result.to })
        .insertContentAt(result.from, toInlineNodes(result.text))
        .run();
    }
    setResult(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={pending !== null}>
            {pending !== null ? (
              <Loader2 aria-hidden className="animate-spin" />
            ) : (
              <Sparkles aria-hidden />
            )}
            AI
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem disabled={!canSummarize} onSelect={() => void summarize()}>
            <ScrollText aria-hidden />
            Summarize note
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger disabled={!canRewrite}>
              <PenLine aria-hidden className="mr-2 size-4 text-muted-foreground" />
              Rewrite selection
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {REWRITE_TONES.map((tone) => (
                <DropdownMenuItem key={tone} onSelect={() => void rewrite(tone)}>
                  Make it {tone}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          {!canSummarize ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Write at least a few sentences to summarize.
            </p>
          ) : !canRewrite ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">
              Select some text to rewrite it.
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={result !== null} onOpenChange={(open) => !open && setResult(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {result?.kind === "summary" ? "Note summary" : "Rewritten text"}
            </DialogTitle>
            <DialogDescription>
              {result?.kind === "summary"
                ? "Generated from the full note content."
                : "Review the rewrite before replacing your selection."}
            </DialogDescription>
          </DialogHeader>
          {result?.kind === "rewrite" ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase">Original</p>
              <p className="max-h-24 overflow-y-auto rounded-md border p-2 text-sm whitespace-pre-wrap text-muted-foreground">
                {result.original}
              </p>
            </div>
          ) : null}
          <div className="space-y-1">
            {result?.kind === "rewrite" ? (
              <p className="text-xs font-medium text-muted-foreground uppercase">Rewrite</p>
            ) : null}
            <p className="max-h-56 overflow-y-auto rounded-md border p-2 text-sm whitespace-pre-wrap">
              {result?.text}
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => void copyResult()}>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied ? "Copied" : "Copy"}
            </Button>
            <Button type="button" onClick={applyResult}>
              <ArrowUpToLine aria-hidden />
              {result?.kind === "summary" ? "Insert at top" : "Replace selection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
