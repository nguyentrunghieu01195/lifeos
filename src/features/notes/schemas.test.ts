import { describe, expect, it } from "vitest";

import { previewOf } from "@/features/notes/server/service";

import { createFolderSchema, rewriteSchema, tiptapDocSchema, updateNoteSchema } from "./schemas";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("tiptapDocSchema", () => {
  it("accepts a minimal Tiptap document", () => {
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    expect(tiptapDocSchema.safeParse(doc).success).toBe(true);
  });

  it("rejects non-doc payloads", () => {
    expect(tiptapDocSchema.safeParse({ type: "paragraph" }).success).toBe(false);
    expect(tiptapDocSchema.safeParse("<p>html</p>").success).toBe(false);
  });

  it("rejects documents above the size cap", () => {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "x".repeat(400_001) }],
        },
      ],
    };
    const result = tiptapDocSchema.safeParse(doc);
    expect(result.success).toBe(false);
  });
});

describe("updateNoteSchema", () => {
  it("allows partial patches", () => {
    expect(updateNoteSchema.safeParse({ id: CUID, title: "Hello" }).success).toBe(true);
    expect(updateNoteSchema.safeParse({ id: CUID, folderId: null }).success).toBe(true);
    expect(updateNoteSchema.safeParse({ id: CUID, tagIds: [] }).success).toBe(true);
  });

  it("rejects malformed ids", () => {
    expect(updateNoteSchema.safeParse({ id: "nope" }).success).toBe(false);
    expect(updateNoteSchema.safeParse({ id: CUID, tagIds: ["nope"] }).success).toBe(false);
  });
});

describe("rewriteSchema", () => {
  it("enforces sensible selection bounds", () => {
    expect(rewriteSchema.safeParse({ text: "too short", tone: "clearer" }).success).toBe(false);
    expect(rewriteSchema.safeParse({ text: "x".repeat(4001), tone: "clearer" }).success).toBe(
      false,
    );
    expect(
      rewriteSchema.safeParse({ text: "This sentence is long enough to rewrite.", tone: "shorter" })
        .success,
    ).toBe(true);
  });

  it("rejects unknown tones", () => {
    expect(
      rewriteSchema.safeParse({ text: "This sentence is long enough.", tone: "sarcastic" }).success,
    ).toBe(false);
  });
});

describe("createFolderSchema", () => {
  it("trims and bounds folder names", () => {
    const parsed = createFolderSchema.safeParse({ name: "  Journal  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("Journal");
    expect(createFolderSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(createFolderSchema.safeParse({ name: "x".repeat(61) }).success).toBe(false);
  });
});

describe("previewOf", () => {
  it("collapses whitespace and truncates long text", () => {
    expect(previewOf("hello\n\n  world")).toBe("hello world");
    const long = previewOf("word ".repeat(100));
    expect(long.length).toBeLessThanOrEqual(181); // 180 chars + ellipsis
    expect(long.endsWith("…")).toBe(true);
  });

  it("returns short text untouched", () => {
    expect(previewOf("Short note")).toBe("Short note");
  });
});
