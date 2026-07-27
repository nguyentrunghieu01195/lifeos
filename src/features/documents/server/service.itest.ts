import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getDb } from "@/lib/db";

import {
  createUpload,
  deleteDocument,
  finalizeUpload,
  getFileDescriptor,
  listDocuments,
  purgeStalePending,
  renameDocument,
} from "./service";

/**
 * The storage layer is mocked: these tests exercise the database rules
 * (ownership, status transitions, cleanup) — the drivers themselves are
 * covered by the e2e suite running against the local driver.
 */
const objectSizes = new Map<string, number>();
const removed: string[] = [];

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    kind: "r2" as const,
    createUploadUrl: async ({ key }: { key: string }) => `https://fake-upload.test/${key}`,
    statSize: async (key: string) => objectSizes.get(key) ?? null,
    createDownloadUrl: async () => "https://fake-download.test",
    remove: async (key: string) => {
      removed.push(key);
      objectSizes.delete(key);
    },
  }),
}));

const hasDatabase = Boolean(process.env.DATABASE_URL);

let userA = "";
let userB = "";

const pngUpload = { name: "photo.png", mimeType: "image/png" as const, size: 2048 };

describe.runIf(hasDatabase)("documents service (integration)", () => {
  beforeAll(async () => {
    const db = getDb();
    const [a, b] = await Promise.all([
      db.user.create({ data: { email: `itest-docs-a-${crypto.randomUUID()}@lifeos.test` } }),
      db.user.create({ data: { email: `itest-docs-b-${crypto.randomUUID()}@lifeos.test` } }),
    ]);
    userA = a.id;
    userB = b.id;
  });

  afterAll(async () => {
    await getDb().user.deleteMany({ where: { id: { in: [userA, userB] } } });
  });

  beforeEach(() => {
    objectSizes.clear();
    removed.length = 0;
  });

  async function keyOf(documentId: string): Promise<string> {
    const row = await getDb().document.findUniqueOrThrow({
      where: { id: documentId },
      select: { key: true },
    });
    return row.key;
  }

  it("uploads become visible only after a verified finalize", async () => {
    const ticket = await createUpload(userA, pngUpload);
    expect(ticket.uploadUrl).toContain("https://fake-upload.test/");

    // Not READY yet — hidden from the library and the file endpoint.
    expect((await listDocuments(userA)).map((doc) => doc.id)).not.toContain(ticket.documentId);
    expect(await getFileDescriptor(userA, ticket.documentId)).toBeNull();

    objectSizes.set(await keyOf(ticket.documentId), pngUpload.size);
    const document = await finalizeUpload(userA, ticket.documentId);
    expect(document.name).toBe("photo.png");

    expect((await listDocuments(userA)).map((doc) => doc.id)).toContain(ticket.documentId);
    const descriptor = await getFileDescriptor(userA, ticket.documentId);
    expect(descriptor?.mimeType).toBe("image/png");
  });

  it("finalize fails cleanly when the object never arrived", async () => {
    const ticket = await createUpload(userA, pngUpload);
    await expect(finalizeUpload(userA, ticket.documentId)).rejects.toThrow("didn't complete");
    // Row stays PENDING so the client may retry the byte transfer.
    const row = await getDb().document.findUnique({ where: { id: ticket.documentId } });
    expect(row?.status).toBe("PENDING");
  });

  it("finalize destroys object and row on a size mismatch", async () => {
    const ticket = await createUpload(userA, pngUpload);
    const key = await keyOf(ticket.documentId);
    objectSizes.set(key, pngUpload.size + 999);

    await expect(finalizeUpload(userA, ticket.documentId)).rejects.toThrow("declared size");
    expect(removed).toContain(key);
    expect(await getDb().document.findUnique({ where: { id: ticket.documentId } })).toBeNull();
  });

  it("never exposes another user's documents", async () => {
    const ticket = await createUpload(userA, pngUpload);
    objectSizes.set(await keyOf(ticket.documentId), pngUpload.size);
    await finalizeUpload(userA, ticket.documentId);

    await expect(finalizeUpload(userB, ticket.documentId)).rejects.toThrow("not found");
    await expect(renameDocument(userB, ticket.documentId, "mine-now")).rejects.toThrow("not found");
    await expect(deleteDocument(userB, ticket.documentId)).rejects.toThrow("not found");
    expect(await getFileDescriptor(userB, ticket.documentId)).toBeNull();
    expect((await listDocuments(userB)).map((doc) => doc.id)).not.toContain(ticket.documentId);
  });

  it("rename updates the display name only", async () => {
    const ticket = await createUpload(userA, pngUpload);
    const key = await keyOf(ticket.documentId);
    objectSizes.set(key, pngUpload.size);
    await finalizeUpload(userA, ticket.documentId);

    const renamed = await renameDocument(userA, ticket.documentId, "vacation.png");
    expect(renamed.name).toBe("vacation.png");
    expect(await keyOf(ticket.documentId)).toBe(key);
  });

  it("delete removes the row and the stored object", async () => {
    const ticket = await createUpload(userA, pngUpload);
    const key = await keyOf(ticket.documentId);
    objectSizes.set(key, pngUpload.size);
    await finalizeUpload(userA, ticket.documentId);

    await deleteDocument(userA, ticket.documentId);
    expect(removed).toContain(key);
    expect(await getFileDescriptor(userA, ticket.documentId)).toBeNull();
  });

  it("purges stale pending uploads but leaves fresh ones alone", async () => {
    const fresh = await createUpload(userA, pngUpload);
    const stale = await createUpload(userA, pngUpload);
    const staleKey = await keyOf(stale.documentId);
    await getDb().$executeRaw`
      UPDATE "documents" SET "updatedAt" = now() - interval '2 days'
      WHERE "id" = ${stale.documentId}
    `;

    await purgeStalePending(userA);

    expect(await getDb().document.findUnique({ where: { id: stale.documentId } })).toBeNull();
    expect(removed).toContain(staleKey);
    expect(await getDb().document.findUnique({ where: { id: fresh.documentId } })).not.toBeNull();
  });
});
