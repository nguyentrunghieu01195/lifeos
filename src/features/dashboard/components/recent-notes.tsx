import { formatDistanceToNow, parseISO } from "date-fns";
import { ArrowRight, StickyNote } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { NoteListItemDto } from "@/features/notes/types";

/** Dashboard widget: the most recently edited notes. */
export function RecentNotesCard({ notes }: { notes: NoteListItemDto[] }) {
  return (
    <Card className="glass">
      <CardHeader>
        <CardTitle>Recent notes</CardTitle>
        <CardDescription>
          {notes.length === 0 ? "Nothing captured yet." : "Pick up where you left off."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {notes.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <StickyNote aria-hidden className="size-4" />
            Your notebook is empty.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {notes.map((note) => (
              <li key={note.id}>
                <Link
                  href={`/notes/${note.id}`}
                  className="-mx-1.5 flex items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-accent/50"
                >
                  <StickyNote aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{note.title}</span>
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNow(parseISO(note.updatedAt), { addSuffix: true })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/notes">
            Open notes
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
