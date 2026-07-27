import { describe, expect, it } from "vitest";

import { formatBytes, INLINE_SAFE_TYPES, kindOf, sanitizeFilename } from "./files";

describe("sanitizeFilename", () => {
  it("strips directories and traversal attempts", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\report.pdf")).toBe("report.pdf");
    expect(sanitizeFilename("a/b/c/photo.png")).toBe("photo.png");
  });

  it("transliterates and normalizes unsafe characters", () => {
    expect(sanitizeFilename("báo cáo quý 1.pdf")).toBe("bao-cao-quy-1.pdf");
    expect(sanitizeFilename('weird  <>:"|?*name.txt')).toBe("weird-name.txt");
  });

  it("never returns an empty name and caps length", () => {
    expect(sanitizeFilename("")).toBe("file");
    expect(sanitizeFilename("///")).toBe("file");
    expect(sanitizeFilename(`${"x".repeat(300)}.png`).length).toBeLessThanOrEqual(120);
    expect(sanitizeFilename(`${"x".repeat(300)}.png`).endsWith(".png")).toBe(true);
  });
});

describe("kindOf", () => {
  it("maps mime types to display kinds", () => {
    expect(kindOf("image/png")).toBe("image");
    expect(kindOf("application/pdf")).toBe("pdf");
    expect(kindOf("text/markdown")).toBe("text");
    expect(kindOf("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "sheet",
    );
    expect(kindOf("application/zip")).toBe("archive");
    expect(kindOf("application/octet-stream")).toBe("other");
  });
});

describe("INLINE_SAFE_TYPES", () => {
  it("previews raster images and pdf, never svg", () => {
    expect(INLINE_SAFE_TYPES.has("image/png")).toBe(true);
    expect(INLINE_SAFE_TYPES.has("application/pdf")).toBe(true);
    // SVG can execute script on our origin — must always download.
    expect(INLINE_SAFE_TYPES.has("image/svg+xml")).toBe(false);
    expect(INLINE_SAFE_TYPES.has("text/plain")).toBe(false);
  });
});

describe("formatBytes", () => {
  it("formats sizes with sensible units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
