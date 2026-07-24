import { describe, expect, it } from "vitest";

import { buildObjectKey, sanitizeFilename, userIdFromObjectKey } from "@/services/storage/keys";

describe("sanitizeFilename", () => {
  it("keeps ordinary filenames intact", () => {
    expect(sanitizeFilename("Quarterly Report v2.pdf")).toBe("Quarterly Report v2.pdf");
  });

  it("strips directory components and traversal attempts", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\resume.docx")).toBe("resume.docx");
  });

  it("removes control characters and key-hostile characters", () => {
    const sanitized = sanitizeFilename("in\u0000voice<>:?\u001F.pdf");
    expect(sanitized).not.toMatch(/[\u0000-\u001F\u007F]/);
    expect(sanitized).not.toMatch(/[<>:?]/);
    expect(sanitized.endsWith(".pdf")).toBe(true);
  });

  it("preserves unicode letters", () => {
    expect(sanitizeFilename("résumé 2026.pdf")).toBe("résumé 2026.pdf");
  });

  it("falls back to a stable name for empty input", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("///")).toBe("file");
  });

  it("caps very long names while preserving the extension", () => {
    const longName = `${"a".repeat(300)}.tar.gz`;
    const sanitized = sanitizeFilename(longName);
    expect(sanitized.length).toBeLessThanOrEqual(100);
    expect(sanitized.endsWith(".gz")).toBe(true);
  });
});

describe("buildObjectKey", () => {
  it("namespaces objects under the owning user with a uuid prefix", () => {
    const key = buildObjectKey({
      userId: "user_123",
      category: "documents",
      filename: "report.pdf",
    });
    expect(key).toMatch(
      /^users\/user_123\/documents\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-report\.pdf$/,
    );
  });

  it("produces unique keys for identical filenames", () => {
    const input = { userId: "u", category: "images" as const, filename: "photo.jpg" };
    expect(buildObjectKey(input)).not.toBe(buildObjectKey(input));
  });
});

describe("userIdFromObjectKey", () => {
  it("extracts the owner from well-formed keys", () => {
    const key = buildObjectKey({ userId: "user_9", category: "avatars", filename: "me.png" });
    expect(userIdFromObjectKey(key)).toBe("user_9");
  });

  it("returns null for foreign keys", () => {
    expect(userIdFromObjectKey("public/shared.png")).toBeNull();
    expect(userIdFromObjectKey("")).toBeNull();
  });
});
