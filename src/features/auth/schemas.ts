import { z } from "zod";

/**
 * Validation for the authentication boundary. These schemas run on both
 * sides: client-side via react-hook-form resolvers for instant feedback,
 * and server-side in actions/authorize — the server never trusts the client.
 */

export const emailSchema = z
  .string({ required_error: "Email is required." })
  .trim()
  .toLowerCase()
  .min(1, "Email is required.")
  .max(254, "Email is too long.")
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string({ required_error: "Password is required." })
  .min(8, "Password must be at least 8 characters.")
  .max(128, "Password must be at most 128 characters.");

export const loginSchema = z.object({
  email: emailSchema,
  // Login accepts any non-empty password — policy only applies when setting one.
  password: z.string({ required_error: "Password is required." }).min(1, "Password is required."),
});

export const registerSchema = z.object({
  name: z
    .string({ required_error: "Name is required." })
    .trim()
    .min(1, "Name is required.")
    .max(100, "Name is too long."),
  email: emailSchema,
  password: passwordSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
