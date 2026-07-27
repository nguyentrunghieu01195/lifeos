import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  createFolder,
  createNote,
  deleteNote,
  getNote,
  getNoteText,
  getRecentNotes,
  listFolders,
  listNotes,
  updateNote,
} from "@/features/notes/server/service";
import { createTag } from "@/features/tasks/server/service";
import { getDb } from "@/lib/db";

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

function doc(text: string) {
  return {
    type: "doc" as const,
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  };
}

describe.runIf(hasDatabase)("notes service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-notes-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-notes-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  it("creates a note with an empty document and updates content + text", async () => {
    const note = await createNote(userA);
    expect(note.title).toBe("Untitled");
    expect(note.content).toMatchObject({ type: "doc" });

    const text = "Grocery ideas for the week: lentils, rice, tomatoes.";
    const updated = await updateNote(userA, {
      id: note.id,
      title: "Groceries",
      content: doc(text),
      contentText: text,
    });
    expect(updated.title).toBe("Groceries");
    expect(updated.preview).toBe(text);

    await expect(getNoteText(userA, note.id)).resolves.toBe(text);
    const detail = await getNote(userA, note.id);
    expect(detail.content).toMatchObject({ type: "doc" });
  });

  it("defaults blank titles back to Untitled", async () => {
    const note = await createNote(userA);
    const updated = await updateNote(userA, { id: note.id, title: "" });
    expect(updated.title).toBe("Untitled");
  });

  it("organizes notes into owned folders and rejects foreign folders", async () => {
    const folder = await createFolder(userA, `Journal-${crypto.randomUUID().slice(0, 8)}`);
    const note = await createNote(userA, folder.id);
    expect(note.folderId).toBe(folder.id);

    const folders = await listFolders(userA);
    expect(folders.some((entry) => entry.id === folder.id)).toBe(true);

    // Another user's folder must never be assignable.
    await expect(createNote(userB, folder.id)).rejects.toThrow("Folder not found");
    const foreign = await createNote(userB);
    await expect(updateNote(userB, { id: foreign.id, folderId: folder.id })).rejects.toThrow(
      "Folder not found",
    );
  });

  it("rejects duplicate folder names per user", async () => {
    const name = `Inbox-${crypto.randomUUID().slice(0, 8)}`;
    await createFolder(userA, name);
    await expect(createFolder(userA, name)).rejects.toThrow("already exists");
    // Same name is fine for a different user.
    await expect(createFolder(userB, name)).resolves.toMatchObject({ name });
  });

  it("connects only tags owned by the caller", async () => {
    const tag = await createTag(userA, `notes-tag-${crypto.randomUUID().slice(0, 8)}`);
    const note = await createNote(userA);
    const tagged = await updateNote(userA, { id: note.id, tagIds: [tag.id] });
    expect(tagged.tags.map((entry) => entry.id)).toEqual([tag.id]);

    // A foreign tag id is silently dropped rather than linked.
    const foreign = await createNote(userB);
    const result = await updateNote(userB, { id: foreign.id, tagIds: [tag.id] });
    expect(result.tags).toHaveLength(0);
  });

  it("never exposes another user's notes", async () => {
    const note = await createNote(userA);
    await updateNote(userA, {
      id: note.id,
      title: "Private",
      content: doc("secret"),
      contentText: "secret",
    });

    await expect(getNote(userB, note.id)).rejects.toThrow("Note not found");
    await expect(getNoteText(userB, note.id)).rejects.toThrow("Note not found");
    await expect(updateNote(userB, { id: note.id, title: "hacked" })).rejects.toThrow(
      "Note not found",
    );
    await expect(deleteNote(userB, note.id)).rejects.toThrow("Note not found");

    const listB = await listNotes(userB);
    expect(listB.some((entry) => entry.id === note.id)).toBe(false);

    // Still intact for the owner.
    const detail = await getNote(userA, note.id);
    expect(detail.title).toBe("Private");
  });

  it("orders recent notes by last edit", async () => {
    const first = await createNote(userA);
    const second = await createNote(userA);
    await updateNote(userA, { id: first.id, title: "Edited last" });

    const recent = await getRecentNotes(userA, 2);
    expect(recent).toHaveLength(2);
    expect(recent[0]?.id).toBe(first.id);
    void second;
  });

  it("deletes notes without touching folders or tags", async () => {
    const folder = await createFolder(userA, `Keep-${crypto.randomUUID().slice(0, 8)}`);
    const note = await createNote(userA, folder.id);
    await deleteNote(userA, note.id);

    await expect(getNote(userA, note.id)).rejects.toThrow("Note not found");
    const folders = await listFolders(userA);
    expect(folders.some((entry) => entry.id === folder.id)).toBe(true);
  });
});
