"use client";

import { Image } from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { ArrowLeft, Check, Loader2, Plus, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { createTagAction } from "@/features/tasks/server/actions";
import { cn } from "@/lib/utils";

import { deleteNoteAction, updateNoteAction } from "../server/actions";
import type { NoteDetailDto, NoteFolderDto, TagDto } from "../types";
import { EditorToolbar } from "./editor-toolbar";
import { NoteAiMenu } from "./note-ai-menu";

const AUTOSAVE_DELAY_MS = 1500;
const RETRY_DELAY_MS = 5000;

type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

const STATUS_LABEL: Record<SaveStatus, string> = {
  idle: "",
  dirty: "Unsaved changes",
  saving: "Saving…",
  saved: "Saved",
  error: "Couldn't save — retrying",
};

interface NoteEditorProps {
  note: NoteDetailDto;
  folders: NoteFolderDto[];
  allTags: TagDto[];
}

const NO_FOLDER = "__none__";

export function NoteEditor({ note, folders, allTags }: NoteEditorProps) {
  const router = useRouter();

  const [title, setTitle] = useState(note.title);
  const [folderId, setFolderId] = useState(note.folderId);
  const [tags, setTags] = useState(allTags);
  const [tagIds, setTagIds] = useState(note.tags.map((tag) => tag.id));
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [newTag, setNewTag] = useState("");

  const titleRef = useRef(note.title);
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      TableKit,
      Image,
      Placeholder.configure({
        placeholder: "Write something — markdown works: # heading, - list, ``` code, > quote",
      }),
    ],
    content: note.content as JSONContent,
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base dark:prose-invert max-w-none",
        "aria-label": "Note content",
      },
    },
    onUpdate: () => markDirty(),
  });

  /** Persists title + content. Returns true when the note is clean afterwards. */
  const flush = useCallback(async (): Promise<boolean> => {
    if (!dirtyRef.current) return true;
    if (savingRef.current) return false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    const editorInstance = editorRef.current;
    if (!editorInstance) return false;

    savingRef.current = true;
    dirtyRef.current = false;
    setStatus("saving");

    // JSON round-trip: ProseMirror creates attrs with a null prototype, which
    // React refuses to serialize across the Server Action boundary.
    const content: unknown = JSON.parse(JSON.stringify(editorInstance.getJSON()));

    const result = await updateNoteAction({
      id: note.id,
      title: titleRef.current.trim().slice(0, 200),
      content,
      contentText: editorInstance.getText(),
    });

    savingRef.current = false;

    if (!result.ok) {
      dirtyRef.current = true;
      setStatus("error");
      timerRef.current = setTimeout(() => void flushRef.current(), RETRY_DELAY_MS);
      return false;
    }

    if (dirtyRef.current) {
      // Typing continued while the request was in flight — save again shortly.
      setStatus("dirty");
      timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
      return false;
    }

    setStatus("saved");
    return true;
  }, [note.id]);

  // Refs keep event handlers and cleanup effects pointed at the latest values
  // without re-registering listeners on every keystroke.
  const editorRef = useRef(editor);
  editorRef.current = editor;
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const markDirty = () => {
    dirtyRef.current = true;
    setStatus("dirty");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_DELAY_MS);
  };

  // Best-effort persistence when the tab hides or the component unmounts.
  useEffect(() => {
    const onPageHide = () => {
      if (dirtyRef.current) void flushRef.current();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onPageHide);
      if (timerRef.current) clearTimeout(timerRef.current);
      if (disarmRef.current) clearTimeout(disarmRef.current);
      if (dirtyRef.current) void flushRef.current();
    };
  }, []);

  const saveMeta = async (patch: { folderId?: string | null; tagIds?: string[] }) => {
    const result = await updateNoteAction({ id: note.id, ...patch });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    return true;
  };

  const changeFolder = async (value: string) => {
    const next = value === NO_FOLDER ? null : value;
    const previous = folderId;
    setFolderId(next);
    if (!(await saveMeta({ folderId: next }))) setFolderId(previous);
  };

  const toggleTag = async (tagId: string) => {
    const previous = tagIds;
    const next = previous.includes(tagId)
      ? previous.filter((id) => id !== tagId)
      : [...previous, tagId];
    setTagIds(next);
    if (!(await saveMeta({ tagIds: next }))) setTagIds(previous);
  };

  const addTag = async () => {
    const name = newTag.trim();
    if (!name) return;
    const result = await createTagAction({ name });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    setTags((list) => [...list, result.data]);
    setNewTag("");
    await toggleTag(result.data.id);
  };

  const confirmDelete = async () => {
    if (!deleteArmed) {
      setDeleteArmed(true);
      if (disarmRef.current) clearTimeout(disarmRef.current);
      disarmRef.current = setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    dirtyRef.current = false; // don't autosave a note that's being deleted
    const result = await deleteNoteAction(note.id);
    if (result.ok) {
      router.push("/notes");
    } else {
      toast.error(result.error);
      setDeleteArmed(false);
    }
  };

  const selectedTags = tags.filter((tag) => tagIds.includes(tag.id));

  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-3"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
          event.preventDefault();
          void flush();
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href="/notes" aria-label="Back to notes">
            <ArrowLeft aria-hidden />
            Notes
          </Link>
        </Button>
        <span
          aria-live="polite"
          className={cn(
            "ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground",
            status === "error" && "text-destructive",
          )}
        >
          {status === "saving" ? <Loader2 aria-hidden className="size-3 animate-spin" /> : null}
          {status === "saved" ? <Check aria-hidden className="size-3" /> : null}
          {STATUS_LABEL[status]}
        </span>
        {editor ? <NoteAiMenu editor={editor} noteId={note.id} flush={flush} /> : null}
        <Button
          type="button"
          variant={deleteArmed ? "destructive" : "ghost"}
          size="sm"
          onClick={() => void confirmDelete()}
          aria-label={deleteArmed ? "Confirm delete note" : "Delete note"}
        >
          <Trash2 aria-hidden />
          {deleteArmed ? "Confirm" : null}
        </Button>
      </div>

      <input
        value={title}
        onChange={(event) => {
          setTitle(event.target.value);
          titleRef.current = event.target.value;
          markDirty();
        }}
        placeholder="Untitled"
        aria-label="Note title"
        maxLength={200}
        className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/50"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={folderId ?? NO_FOLDER} onValueChange={(value) => void changeFolder(value)}>
          <SelectTrigger size="sm" className="w-44" aria-label="Folder">
            <SelectValue placeholder="Folder" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_FOLDER}>No folder</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <Tags aria-hidden />
              Tags
              {tagIds.length > 0 ? (
                <Badge variant="secondary" className="px-1.5 text-[10px]">
                  {tagIds.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-2 p-3" align="start">
            <p className="text-sm font-medium">Tags</p>
            {tags.length === 0 ? (
              <p className="text-xs text-muted-foreground">No tags yet — create one below.</p>
            ) : (
              <div className="max-h-48 space-y-1.5 overflow-y-auto">
                {tags.map((tag) => (
                  <label key={tag.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={tagIds.includes(tag.id)}
                      onCheckedChange={() => void toggleTag(tag.id)}
                      aria-label={`Tag ${tag.name}`}
                    />
                    <span
                      aria-hidden
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </label>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <Input
                value={newTag}
                onChange={(event) => setNewTag(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void addTag();
                  }
                }}
                placeholder="New tag"
                aria-label="New tag name"
                className="h-8 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0"
                aria-label="Add tag"
                onClick={() => void addTag()}
              >
                <Plus aria-hidden className="size-4" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {selectedTags.map((tag) => (
          <Badge key={tag.id} variant="outline" className="gap-1 text-[10px] font-normal">
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
            {tag.name}
          </Badge>
        ))}
      </div>

      {editor ? (
        <>
          <div className="sticky top-14 z-10 bg-background/95">
            <EditorToolbar editor={editor} />
          </div>
          <div
            className="cursor-text pb-24"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                editor.chain().focus("end").run();
              }
            }}
          >
            <EditorContent editor={editor} />
          </div>
        </>
      ) : (
        <div className="space-y-2 pt-2" aria-hidden>
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-3/5" />
        </div>
      )}
    </div>
  );
}
