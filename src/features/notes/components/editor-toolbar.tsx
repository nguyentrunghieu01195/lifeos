"use client";

import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  TextQuote,
  Underline,
  Undo2,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface EditorToolbarProps {
  editor: Editor;
}

interface ToolButtonProps {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

function ToolButton({ label, active, disabled, onClick, children }: ToolButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn("size-8", active && "bg-accent text-accent-foreground")}
    >
      {children}
    </Button>
  );
}

function Divider() {
  return <Separator orientation="vertical" className="mx-0.5 h-5!" />;
}

/**
 * A single URL prompt used for both links and images: small popover with an
 * input, submit on Enter. Only http(s) URLs are accepted.
 */
function UrlPopover({
  label,
  icon,
  active,
  initialValue,
  onSubmit,
  onRemove,
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  initialValue?: string;
  onSubmit: (url: string) => void;
  onRemove?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  const submit = () => {
    const url = value.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      setError(true);
      return;
    }
    onSubmit(url);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setValue(initialValue ?? "");
          setError(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={label}
          title={label}
          aria-pressed={active}
          className={cn("size-8", active && "bg-accent text-accent-foreground")}
        >
          {icon}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-3" align="start">
        <p className="text-sm font-medium">{label}</p>
        <Input
          autoFocus
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setError(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
          }}
          placeholder="https://…"
          aria-label={`${label} URL`}
          aria-invalid={error}
        />
        {error ? <p className="text-xs text-destructive">Enter a valid http(s) URL.</p> : null}
        <div className="flex justify-end gap-2">
          {onRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
            >
              Remove
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={submit}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive("bold"),
      italic: ctx.editor.isActive("italic"),
      underline: ctx.editor.isActive("underline"),
      strike: ctx.editor.isActive("strike"),
      code: ctx.editor.isActive("code"),
      h1: ctx.editor.isActive("heading", { level: 1 }),
      h2: ctx.editor.isActive("heading", { level: 2 }),
      h3: ctx.editor.isActive("heading", { level: 3 }),
      bulletList: ctx.editor.isActive("bulletList"),
      orderedList: ctx.editor.isActive("orderedList"),
      blockquote: ctx.editor.isActive("blockquote"),
      codeBlock: ctx.editor.isActive("codeBlock"),
      link: ctx.editor.isActive("link"),
      linkHref: (ctx.editor.getAttributes("link").href as string | undefined) ?? "",
      inTable: ctx.editor.isActive("table"),
      canUndo: ctx.editor.can().undo(),
      canRedo: ctx.editor.can().redo(),
    }),
  });

  const chain = () => editor.chain().focus();

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="flex flex-wrap items-center gap-0.5 rounded-lg border bg-background/80 p-1 supports-backdrop-filter:backdrop-blur"
    >
      <ToolButton label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()}>
        <Undo2 aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()}>
        <Redo2 aria-hidden className="size-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Heading 1"
        active={state.h1}
        onClick={() => chain().toggleHeading({ level: 1 }).run()}
      >
        <Heading1 aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Heading 2"
        active={state.h2}
        onClick={() => chain().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Heading 3"
        active={state.h3}
        onClick={() => chain().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 aria-hidden className="size-4" />
      </ToolButton>

      <Divider />

      <ToolButton label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()}>
        <Bold aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()}>
        <Italic aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Underline"
        active={state.underline}
        onClick={() => chain().toggleUnderline().run()}
      >
        <Underline aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => chain().toggleStrike().run()}
      >
        <Strikethrough aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Inline code"
        active={state.code}
        onClick={() => chain().toggleCode().run()}
      >
        <Code aria-hidden className="size-4" />
      </ToolButton>

      <Divider />

      <ToolButton
        label="Bullet list"
        active={state.bulletList}
        onClick={() => chain().toggleBulletList().run()}
      >
        <List aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Numbered list"
        active={state.orderedList}
        onClick={() => chain().toggleOrderedList().run()}
      >
        <ListOrdered aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Quote"
        active={state.blockquote}
        onClick={() => chain().toggleBlockquote().run()}
      >
        <TextQuote aria-hidden className="size-4" />
      </ToolButton>
      <ToolButton
        label="Code block"
        active={state.codeBlock}
        onClick={() => chain().toggleCodeBlock().run()}
      >
        <SquareCode aria-hidden className="size-4" />
      </ToolButton>

      <Divider />

      <UrlPopover
        label="Link"
        icon={<LinkIcon aria-hidden className="size-4" />}
        active={state.link}
        initialValue={state.linkHref}
        onSubmit={(url) => chain().extendMarkRange("link").setLink({ href: url }).run()}
        onRemove={state.link ? () => chain().extendMarkRange("link").unsetLink().run() : undefined}
      />
      <UrlPopover
        label="Image"
        icon={<ImagePlus aria-hidden className="size-4" />}
        onSubmit={(url) => chain().setImage({ src: url }).run()}
      />
      <ToolButton
        label="Insert table"
        active={state.inTable}
        onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <TableIcon aria-hidden className="size-4" />
      </ToolButton>

      {state.inTable ? (
        <>
          <Divider />
          <div className="flex items-center gap-0.5" role="group" aria-label="Table tools">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => chain().addRowAfter().run()}
            >
              + Row
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => chain().addColumnAfter().run()}
            >
              + Col
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => chain().deleteRow().run()}
            >
              − Row
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => chain().deleteColumn().run()}
            >
              − Col
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs text-destructive"
              onClick={() => chain().deleteTable().run()}
            >
              Delete table
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}
