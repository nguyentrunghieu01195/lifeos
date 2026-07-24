import { describe, expect, it } from "vitest";

import { loginSchema, registerSchema } from "@/features/auth/schemas";

describe("registerSchema", () => {
  it("accepts valid input and normalizes the email", () => {
    const result = registerSchema.parse({
      name: "  Hieu Nguyen  ",
      email: "  Hieu@Example.COM ",
      password: "correct horse battery",
    });
    expect(result.name).toBe("Hieu Nguyen");
    expect(result.email).toBe("hieu@example.com");
  });

  it("rejects passwords shorter than 8 characters", () => {
    const result = registerSchema.safeParse({
      name: "Hieu",
      email: "hieu@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.password?.[0]).toContain("at least 8");
    }
  });

  it("rejects invalid emails and empty names", () => {
    const result = registerSchema.safeParse({
      name: "   ",
      email: "not-an-email",
      password: "long enough password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = result.error.flatten().fieldErrors;
      expect(errors.name).toBeDefined();
      expect(errors.email).toBeDefined();
    }
  });
});

describe("loginSchema", () => {
  it("requires a password but applies no length policy at login", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("normalizes the email the same way as registration", () => {
    const result = loginSchema.parse({ email: " A@B.CO ", password: "secret" });
    expect(result.email).toBe("a@b.co");
  });
});
