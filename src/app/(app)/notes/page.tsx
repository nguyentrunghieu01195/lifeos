import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NotesList } from "@/features/notes/components/notes-list";
import { listFolders, listNotes } from "@/features/notes/server/service";
import { getSessionUserId } from "@/lib/auth";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/login");
  }

  const [notes, folders] = await Promise.all([listNotes(userId), listFolders(userId)]);

  return <NotesList initialNotes={notes} initialFolders={folders} />;
}
