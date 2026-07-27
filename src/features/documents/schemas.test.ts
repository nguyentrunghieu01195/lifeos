import { describe, expect, it } from "vitest";

import { MAX_FILE_SIZE } from "./lib/files";
import { createUploadSchema, renameDocumentSchema } from "./schemas";

const CUID = "cjld2cjxh0000qzrmn831i7rn";

describe("createUploadSchema", () => {
  it("accepts a valid upload declaration", () => {
    const parsed = createUploadSchema.safeParse({
      name: "report.pdf",
      mimeType: "application/pdf",
      size: 1024,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects unsupported mime types", () => {
    expect(
      createUploadSchema.safeParse({
        name: "app.exe",
        mimeType: "application/x-msdownload",
        size: 10,
      }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({ name: "page.html", mimeType: "text/html", size: 10 }).success,
    ).toBe(false);
  });

  it("enforces the size envelope", () => {
    expect(
      createUploadSchema.safeParse({ name: "a.png", mimeType: "image/png", size: 0 }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({
        name: "a.png",
        mimeType: "image/png",
        size: MAX_FILE_SIZE + 1,
      }).success,
    ).toBe(false);
    expect(
      createUploadSchema.safeParse({ name: "a.png", mimeType: "image/png", size: MAX_FILE_SIZE })
        .success,
    ).toBe(true);
  });
});

describe("renameDocumentSchema", () => {
  it("trims and bounds names", () => {
    const parsed = renameDocumentSchema.safeParse({ id: CUID, name: "  notes.txt  " });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.name).toBe("notes.txt");
    expect(renameDocumentSchema.safeParse({ id: CUID, name: "  " }).success).toBe(false);
    expect(renameDocumentSchema.safeParse({ id: "nope", name: "x" }).success).toBe(false);
  });
});
