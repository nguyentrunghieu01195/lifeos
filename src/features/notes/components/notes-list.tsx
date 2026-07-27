"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import { FolderPlus, Loader2, Plus, StickyNote } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { createNoteAction, createNoteFolderAction } from "../server/actions";
import type { NoteFolderDto, NoteListItemDto } from "../types";

interface NotesListProps {
  initialNotes: NoteListItemDto[];
  initialFolders: NoteFolderDto[];
}

export function NotesList({ initialNotes, initialFolders }: NotesListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [folders, setFolders] = useState(initialFolders);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFolder, setNewFolder] = useState("");
  const [showFolderInput, setShowFolderInput] = useState(false);
  const creatingRef = useRef(false);

  const createAndOpen = async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    setCreating(true);
    const result = await createNoteAction(activeFolder ? { folderId: activeFolder } : {});
    if (result.ok) {
      router.push(`/notes/${result.data.id}`);
    } else {
      toast.error(result.error);
      creatingRef.current = false;
      setCreating(false);
    }
  };

  // /notes?new=1 (command palette) creates a note and opens the editor.
  useEffect(() => {
    if (searchParams.get("new") === "1") {
      router.replace(pathname);
      void createAndOpen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const addFolder = async () => {
    const name = newFolder.trim();
    if (!name) return;
    const result = await createNoteFolderAction({ name });
    if (result.ok) {
      setFolders((list) => [...list, result.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolder("");
      setShowFolderInput(false);
    } else {
      toast.error(result.error);
    }
  };

  const term = search.trim().toLowerCase();
  const filtered = initialNotes.filter((note) => {
    if (activeFolder && note.folderId !== activeFolder) return false;
    if (!term) return true;
    return note.title.toLowerCase().includes(term) || note.preview.toLowerCase().includes(term);
  });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          className="min-w-56 flex-1"
        />
        <Button onClick={() => void createAndOpen()} disabled={creating}>
          {creating ? <Loader2 aria-hidden className="animate-spin" /> : <Plus aria-hidden />}
          New note
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setActiveFolder(null)}
          aria-pressed={activeFolder === null}
        >
          <Badge variant={activeFolder === null ? "default" : "outline"}>All notes</Badge>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => setActiveFolder((current) => (current === folder.id ? null : folder.id))}
            aria-pressed={activeFolder === folder.id}
          >
            <Badge variant={activeFolder === folder.id ? "default" : "outline"}>
              {folder.name}
            </Badge>
          </button>
        ))}
        {showFolderInput ? (
          <span className="flex items-center gap-1">
            <Input
              autoFocus
              value={newFolder}
              onChange={(event) => setNewFolder(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void addFolder();
                if (event.key === "Escape") setShowFolderInput(false);
              }}
              placeholder="Folder name"
              className="h-7 w-36 text-xs"
              aria-label="New folder name"
            />
            <Button size="sm" variant="outline" className="h-7" onClick={() => void addFolder()}>
              Add
            </Button>
          </span>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-muted-foreground"
            onClick={() => setShowFolderInput(true)}
          >
            <FolderPlus aria-hidden className="size-3.5" />
            New folder
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground">
          <StickyNote aria-hidden className="size-6" />
          {initialNotes.length === 0
            ? "No notes yet — capture your first thought."
            : "Nothing matches this filter."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="group">
              <Card
                className={cn("h-full gap-3 glass py-4 transition-shadow group-hover:shadow-md")}
              >
                <CardContent className="space-y-2 px-4">
                  <p className="truncate font-semibold">{note.title}</p>
                  <p className="line-clamp-3 min-h-10 text-sm text-muted-foreground">
                    {note.preview || "Empty note"}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {note.folder ? (
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {note.folder.name}
                      </Badge>
                    ) : null}
                    {note.tags.map((tag) => (
                      <Badge
                        key={tag.id}
                        variant="outline"
                        className="gap-1 text-[10px] font-normal"
                      >
                        <span
                          aria-hidden
                          className="size-2 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        {tag.name}
                      </Badge>
                    ))}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {formatDistanceToNow(parseISO(note.updatedAt), { addSuffix: true })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
