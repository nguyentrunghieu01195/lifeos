"use client";

import { format, parseISO } from "date-fns";
import {
  Download,
  Eye,
  File,
  FileArchive,
  FileImage,
  FileSpreadsheet,
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import {
  ACCEPTED_MIME_TYPES,
  formatBytes,
  INLINE_SAFE_TYPES,
  kindOf,
  MAX_FILE_SIZE,
  type DocumentKind,
} from "../lib/files";
import {
  createUploadAction,
  deleteDocumentAction,
  finalizeUploadAction,
  renameDocumentAction,
} from "../server/actions";
import type { DocumentDto } from "../types";

const KIND_ICONS: Record<DocumentKind, typeof File> = {
  image: FileImage,
  pdf: FileText,
  text: FileText,
  sheet: FileSpreadsheet,
  archive: FileArchive,
  other: File,
};

const FILTERS = [
  { id: "all", label: "All files" },
  { id: "image", label: "Images" },
  { id: "pdf", label: "PDFs" },
  { id: "docs", label: "Documents" },
  { id: "other", label: "Other" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

function matchesFilter(kind: DocumentKind, filter: FilterId): boolean {
  switch (filter) {
    case "all":
      return true;
    case "image":
      return kind === "image";
    case "pdf":
      return kind === "pdf";
    case "docs":
      return kind === "text" || kind === "sheet";
    case "other":
      return kind === "archive" || kind === "other";
  }
}

interface TransientUpload {
  id: number;
  name: string;
  status: "uploading" | "error";
  error?: string;
}

interface DocumentsViewProps {
  initialDocuments: DocumentDto[];
}

export function DocumentsView({ initialDocuments }: DocumentsViewProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const transientId = useRef(0);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [uploads, setUploads] = useState<TransientUpload[]>([]);
  const [dragging, setDragging] = useState(false);
  const [preview, setPreview] = useState<DocumentDto | null>(null);
  const [renaming, setRenaming] = useState<DocumentDto | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleting, setDeleting] = useState<DocumentDto | null>(null);
  const [busy, setBusy] = useState(false);

  const uploadOne = async (file: globalThis.File): Promise<void> => {
    const mimeType = file.type || "application/octet-stream";
    if (!(ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType)) {
      toast.error(`"${file.name}" isn't a supported file type.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(`"${file.name}" is over the 25 MB limit.`);
      return;
    }
    if (file.size === 0) {
      toast.error(`"${file.name}" is empty.`);
      return;
    }

    const id = ++transientId.current;
    setUploads((list) => [...list, { id, name: file.name, status: "uploading" }]);

    const fail = (message: string) => {
      setUploads((list) =>
        list.map((entry) =>
          entry.id === id ? { ...entry, status: "error" as const, error: message } : entry,
        ),
      );
    };

    const ticket = await createUploadAction({ name: file.name, mimeType, size: file.size });
    if (!ticket.ok) {
      fail(ticket.error);
      return;
    }

    try {
      const response = await fetch(ticket.data.uploadUrl, { method: "PUT", body: file });
      if (!response.ok) {
        fail(`Upload failed (${response.status}).`);
        return;
      }
    } catch {
      fail("Upload failed — check your connection.");
      return;
    }

    const finalized = await finalizeUploadAction(ticket.data.documentId);
    if (!finalized.ok) {
      fail(finalized.error);
      return;
    }

    setUploads((list) => list.filter((entry) => entry.id !== id));
  };

  const uploadFiles = async (files: FileList | globalThis.File[]) => {
    for (const file of Array.from(files)) {
      await uploadOne(file);
    }
  };

  const submitRename = async () => {
    if (!renaming) return;
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    const result = await renameDocumentAction({ id: renaming.id, name });
    setBusy(false);
    if (result.ok) {
      setRenaming(null);
    } else {
      toast.error(result.error);
    }
  };

  const submitDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    const result = await deleteDocumentAction(deleting.id);
    setBusy(false);
    if (result.ok) {
      setDeleting(null);
    } else {
      toast.error(result.error);
    }
  };

  const term = search.trim().toLowerCase();
  const visible = initialDocuments.filter((document) => {
    if (!matchesFilter(kindOf(document.mimeType), filter)) return false;
    return !term || document.name.toLowerCase().includes(term);
  });

  return (
    <div
      className="mx-auto w-full max-w-5xl space-y-4"
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (event.dataTransfer.files.length > 0) {
          void uploadFiles(event.dataTransfer.files);
        }
      }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search files…"
          aria-label="Search files"
          className="min-w-56 flex-1"
        />
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          accept={ACCEPTED_MIME_TYPES.join(",")}
          aria-label="Choose files to upload"
          onChange={(event) => {
            if (event.target.files?.length) {
              void uploadFiles(event.target.files);
              event.target.value = "";
            }
          }}
        />
        <Button onClick={() => inputRef.current?.click()}>
          <UploadCloud aria-hidden />
          Upload
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setFilter(entry.id)}
            aria-pressed={filter === entry.id}
          >
            <Badge variant={filter === entry.id ? "default" : "outline"}>{entry.label}</Badge>
          </button>
        ))}
      </div>

      {uploads.length > 0 ? (
        <ul className="space-y-1.5" aria-label="Uploads in progress">
          {uploads.map((upload) => (
            <li
              key={upload.id}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                upload.status === "error" && "border-destructive/50",
              )}
            >
              {upload.status === "uploading" ? (
                <Loader2 aria-hidden className="size-4 animate-spin text-muted-foreground" />
              ) : (
                <X aria-hidden className="size-4 text-destructive" />
              )}
              <span className="truncate">{upload.name}</span>
              <span
                className={cn(
                  "ml-auto text-xs",
                  upload.status === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {upload.status === "uploading" ? "Uploading…" : upload.error}
              </span>
              {upload.status === "error" ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  aria-label={`Dismiss failed upload ${upload.name}`}
                  onClick={() =>
                    setUploads((list) => list.filter((entry) => entry.id !== upload.id))
                  }
                >
                  <X aria-hidden className="size-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {visible.length === 0 ? (
        <div
          className={cn(
            "flex flex-col items-center gap-2 rounded-xl border border-dashed p-12 text-center text-sm text-muted-foreground transition-colors",
            dragging && "border-primary text-foreground",
          )}
        >
          <UploadCloud aria-hidden className="size-6" />
          {initialDocuments.length === 0
            ? "No files yet — upload or drop something here."
            : "Nothing matches this filter."}
        </div>
      ) : (
        <ul
          className={cn(
            "divide-y rounded-xl border transition-colors",
            dragging && "border-primary",
          )}
        >
          {visible.map((document) => {
            const kind = kindOf(document.mimeType);
            const Icon = KIND_ICONS[kind];
            const canPreview = INLINE_SAFE_TYPES.has(document.mimeType);
            return (
              <li key={document.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                <Icon aria-hidden className="size-4.5 shrink-0 text-muted-foreground" />
                {canPreview ? (
                  <button
                    type="button"
                    className="truncate text-left font-medium hover:underline"
                    onClick={() => setPreview(document)}
                  >
                    {document.name}
                  </button>
                ) : (
                  <a
                    href={`/api/files/${document.id}?download=1`}
                    className="truncate font-medium hover:underline"
                  >
                    {document.name}
                  </a>
                )}
                <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                  {formatBytes(document.size)}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                  {format(parseISO(document.createdAt), "MMM d, yyyy")}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label={`Actions for ${document.name}`}
                    >
                      <MoreHorizontal aria-hidden className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    {canPreview ? (
                      <DropdownMenuItem onSelect={() => setPreview(document)}>
                        <Eye aria-hidden />
                        Preview
                      </DropdownMenuItem>
                    ) : null}
                    <DropdownMenuItem asChild>
                      <a href={`/api/files/${document.id}?download=1`}>
                        <Download aria-hidden />
                        Download
                      </a>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setRenameValue(document.name);
                        setRenaming(document);
                      }}
                    >
                      <Pencil aria-hidden />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(document)}>
                      <Trash2 aria-hidden />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
        </ul>
      )}

      <PreviewDialog document={preview} onClose={() => setPreview(null)} />

      <Dialog open={renaming !== null} onOpenChange={(open) => !open && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename file</DialogTitle>
            <DialogDescription>The stored file itself is not modified.</DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void submitRename();
              }
            }}
            aria-label="New file name"
            maxLength={200}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button onClick={() => void submitRename()} disabled={busy || !renameValue.trim()}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              “{deleting?.name}” will be removed permanently. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void submitDelete()} disabled={busy}>
              {busy ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PreviewDialog({
  document,
  onClose,
}: {
  document: DocumentDto | null;
  onClose: () => void;
}) {
  let body: ReactNode = null;
  if (document) {
    const url = `/api/files/${document.id}`;
    body =
      kindOf(document.mimeType) === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- authenticated, freshly uploaded blob; next/image adds nothing here
        <img src={url} alt={document.name} className="max-h-[70vh] w-full object-contain" />
      ) : (
        <iframe src={url} title={document.name} className="h-[70vh] w-full rounded-md border" />
      );
  }

  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{document?.name}</DialogTitle>
          <DialogDescription>
            {document ? `${formatBytes(document.size)} · ${document.mimeType}` : null}
          </DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="outline" asChild>
            <a href={document ? `/api/files/${document.id}?download=1` : "#"}>
              <Download aria-hidden />
              Download
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
