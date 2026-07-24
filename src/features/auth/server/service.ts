import "server-only";

import { getDb } from "@/lib/db";

import type { RegisterInput } from "../schemas";
import { getDummyHash, hashPassword, verifyPassword } from "./password";

/**
 * Authentication domain service. Pure server-side; consumed by the
 * Credentials provider (authorize) and the register server action.
 */

export type RegisterResult = { ok: true; userId: string } | { ok: false; error: "email_taken" };

export async function registerUser(input: RegisterInput): Promise<RegisterResult> {
  const db = getDb();

  const existing = await db.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return { ok: false, error: "email_taken" };
  }

  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash,
      },
    });
    return { ok: true, userId: user.id };
  } catch (error) {
    // Unique-constraint race between the existence check and the insert.
    if (isUniqueConstraintViolation(error)) {
      return { ok: false, error: "email_taken" };
    }
    throw error;
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

/**
 * Verify email/password credentials. Timing is equalized between "unknown
 * email" and "wrong password" (both perform one Argon2 verification) and the
 * caller surfaces one identical error message for both cases.
 */
export async function verifyUserCredentials(
  email: string,
  password: string,
): Promise<AuthenticatedUser | null> {
  const db = getDb();
  const user = await db.user.findUnique({ where: { email } });

  if (!user?.passwordHash) {
    await verifyPassword(await getDummyHash(), password);
    return null;
  }

  const valid = await verifyPassword(user.passwordHash, password);
  if (!valid) {
    return null;
  }
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}
