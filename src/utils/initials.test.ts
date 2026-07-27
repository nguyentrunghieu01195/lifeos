import { describe, expect, it } from "vitest";

import { initialsOf } from "@/utils/initials";

describe("initialsOf", () => {
  it("uses first and last name initials", () => {
    expect(initialsOf("Hieu Nguyen", "h@example.com")).toBe("HN");
    expect(initialsOf("Trung Hieu Nguyen", "h@example.com")).toBe("TN");
  });

  it("falls back to the email when the name is missing or blank", () => {
    expect(initialsOf(null, "hieu@example.com")).toBe("H");
    expect(initialsOf("   ", "zoe@example.com")).toBe("Z");
  });

  it("handles single-word names", () => {
    expect(initialsOf("Madonna", "m@example.com")).toBe("M");
  });
});
