import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { NoteEditor } from "@/features/notes/components/note-editor";
import { getNote, listFolders } from "@/features/notes/server/service";
import { listTags } from "@/features/tasks/server/service";
import { getSessionUserId } from "@/lib/auth";
import { isAppError } from "@/lib/errors";

interface NotePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: NotePageProps): Promise<Metadata> {
  const userId = await getSessionUserId();
  if (!userId) return { title: "Note" };
  const { id } = await params;
  try {
    const note = await getNote(userId, id);
    return { title: note.title };
  } catch {
    return { title: "Note" };
  }
}

export default async function NotePage({ params }: NotePageProps) {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const { id } = await params;

  let note;
  try {
    note = await getNote(userId, id);
  } catch (error) {
    if (isAppError(error) && error.status === 404) {
      notFound();
    }
    throw error;
  }

  const [folders, tags] = await Promise.all([listFolders(userId), listTags(userId)]);

  return <NoteEditor note={note} folders={folders} allTags={tags} />;
}
