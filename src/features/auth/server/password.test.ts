import { describe, expect, it } from "vitest";

import { getDummyHash, hashPassword, verifyPassword } from "@/features/auth/server/password";

describe("password hashing (argon2id)", () => {
  it("hashes and verifies a password round-trip", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(verifyPassword(hash, "correct horse battery staple")).resolves.toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("correct horse battery staple");
    await expect(verifyPassword(hash, "incorrect horse")).resolves.toBe(false);
  });

  it("produces unique salts for identical passwords", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same password"),
      hashPassword("same password"),
    ]);
    expect(first).not.toBe(second);
  });

  it("returns false (never throws) for malformed hashes", async () => {
    await expect(verifyPassword("not-a-hash", "anything")).resolves.toBe(false);
    await expect(verifyPassword("", "anything")).resolves.toBe(false);
  });

  it("provides a stable dummy hash for timing equalization", async () => {
    const dummy = await getDummyHash();
    expect(dummy).toMatch(/^\$argon2id\$/);
    await expect(getDummyHash()).resolves.toBe(dummy);
    await expect(verifyPassword(dummy, "any guess")).resolves.toBe(false);
  });
});
