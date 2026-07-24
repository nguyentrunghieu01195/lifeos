import { hash, verify } from "@node-rs/argon2";

/**
 * Password hashing with Argon2id (OWASP-recommended parameters:
 * 19 MiB memory, 2 iterations, parallelism 1).
 */
const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

/** Returns false for wrong passwords AND malformed hashes — never throws. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * A valid hash of an unguessable value, used to equalize timing when the
 * account does not exist (mitigates user enumeration via response timing).
 */
export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(`dummy-${crypto.randomUUID()}`);
  return dummyHashPromise;
}
