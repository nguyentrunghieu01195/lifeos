"use server";

import { headers } from "next/headers";
import { AuthError } from "next-auth";

import { signIn, signOut } from "@/lib/auth";
import { createRateLimiter, type RateLimiter } from "@/lib/rate-limit";

import { loginSchema, registerSchema } from "../schemas";
import type { AuthFormState } from "../types";
import { registerUser } from "./service";

/**
 * Auth server actions. Every action:
 *  1. applies a rate limit keyed by client IP (+ email for sign-in),
 *  2. validates input with Zod (the client-side validation is UX only),
 *  3. returns a typed AuthFormState — or redirects on success via Auth.js.
 */

let registerLimiter: RateLimiter | null = null;
let loginLimiter: RateLimiter | null = null;

function getRegisterLimiter(): RateLimiter {
  registerLimiter ??= createRateLimiter({ name: "auth-register", limit: 5, windowSeconds: 600 });
  return registerLimiter;
}

function getLoginLimiter(): RateLimiter {
  loginLimiter ??= createRateLimiter({ name: "auth-login", limit: 10, windowSeconds: 300 });
  return loginLimiter;
}

async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return headerStore.get("x-real-ip") ?? "unknown";
}

const RATE_LIMIT_MESSAGE = "Too many attempts. Please wait a few minutes and try again.";
const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export async function registerAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const ip = await getClientIp();
  const limit = await getRegisterLimiter().limit(ip);
  if (!limit.success) {
    return { status: "error", formError: RATE_LIMIT_MESSAGE };
  }

  const parsed = registerSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      fieldErrors: {
        name: flat.name?.[0],
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
    };
  }

  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return {
      status: "error",
      fieldErrors: { email: "An account with this email already exists." },
    };
  }

  try {
    // Auto sign-in after registration; redirects to the dashboard on success.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // Account exists but the automatic sign-in failed — send them to login.
      return {
        status: "error",
        formError: "Account created. Please sign in.",
      };
    }
    throw error; // NEXT_REDIRECT and unexpected errors propagate.
  }
  return { status: "idle" };
}

export async function loginAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      status: "error",
      fieldErrors: {
        email: flat.email?.[0],
        password: flat.password?.[0],
      },
    };
  }

  const ip = await getClientIp();
  const limit = await getLoginLimiter().limit(`${ip}:${parsed.data.email}`);
  if (!limit.success) {
    return { status: "error", formError: RATE_LIMIT_MESSAGE };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // One identical message for unknown email and wrong password.
      return { status: "error", formError: INVALID_CREDENTIALS_MESSAGE };
    }
    throw error;
  }
  return { status: "idle" };
}

const OAUTH_PROVIDERS = ["google", "github"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

export async function signInWithProviderAction(provider: OAuthProvider): Promise<void> {
  if (!OAUTH_PROVIDERS.includes(provider)) {
    throw new Error(`Unsupported OAuth provider: ${provider as string}`);
  }
  await signIn(provider, { redirectTo: "/dashboard" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}
