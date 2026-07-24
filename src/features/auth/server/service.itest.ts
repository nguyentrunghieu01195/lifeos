import { afterAll, describe, expect, it } from "vitest";

import { registerSchema } from "@/features/auth/schemas";
import { registerUser, verifyUserCredentials } from "@/features/auth/server/service";
import { getDb } from "@/lib/db";

/**
 * Integration tests against a real Postgres (embedded local DB or the CI
 * service container). Enabled via `pnpm test:integration`.
 */

const hasDatabase = Boolean(process.env.DATABASE_URL);
const createdUserIds: string[] = [];

function uniqueEmail(): string {
  return `itest-${crypto.randomUUID()}@lifeos.test`;
}

function validInput(overrides: Partial<{ name: string; email: string; password: string }> = {}) {
  return registerSchema.parse({
    name: "Integration Tester",
    email: uniqueEmail(),
    password: "a sufficiently long password",
    ...overrides,
  });
}

describe.runIf(hasDatabase)("auth service (integration)", () => {
  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await getDb().user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("registers a user and verifies the correct password", async () => {
    const input = validInput();
    const result = await registerUser(input);
    expect(result.ok).toBe(true);
    if (result.ok) createdUserIds.push(result.userId);

    const user = await verifyUserCredentials(input.email, input.password);
    expect(user).not.toBeNull();
    expect(user?.email).toBe(input.email);
  });

  it("rejects a wrong password for an existing user", async () => {
    const input = validInput();
    const result = await registerUser(input);
    expect(result.ok).toBe(true);
    if (result.ok) createdUserIds.push(result.userId);

    await expect(verifyUserCredentials(input.email, "totally wrong password")).resolves.toBeNull();
  });

  it("returns email_taken for duplicate registrations", async () => {
    const input = validInput();
    const first = await registerUser(input);
    expect(first.ok).toBe(true);
    if (first.ok) createdUserIds.push(first.userId);

    const second = await registerUser(validInput({ email: input.email }));
    expect(second).toEqual({ ok: false, error: "email_taken" });
  });

  it("returns null for unknown emails (with timing equalization)", async () => {
    await expect(verifyUserCredentials(uniqueEmail(), "any password at all")).resolves.toBeNull();
  });

  it("stores no plaintext password", async () => {
    const input = validInput();
    const result = await registerUser(input);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    createdUserIds.push(result.userId);

    const row = await getDb().user.findUniqueOrThrow({ where: { id: result.userId } });
    expect(row.passwordHash).toBeTruthy();
    expect(row.passwordHash).not.toContain(input.password);
    expect(row.passwordHash).toMatch(/^\$argon2id\$/);
  });
});
