import { describe, expect, it } from "vitest";

import { validateEnvironment } from "@/lib/env";

/** A fully configured production environment. */
const fullProduction: NodeJS.ProcessEnv = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/lifeos",
  AUTH_SECRET: "a-test-signing-secret",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  AI_PROVIDER: "gemini",
  GEMINI_API_KEY: "test-key",
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "token",
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "lifeos",
};

describe("validateEnvironment", () => {
  it("accepts a fully configured production environment", () => {
    const report = validateEnvironment(fullProduction);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
  });

  it("errors on a missing DATABASE_URL in any environment", () => {
    for (const nodeEnv of ["development", "production"] as const) {
      const report = validateEnvironment({
        ...fullProduction,
        NODE_ENV: nodeEnv,
        DATABASE_URL: undefined,
      });
      expect(report.errors.join("\n")).toContain("DATABASE_URL");
    }
  });

  it("warns (never errors) when the selected provider's key is missing — AI ships later", () => {
    for (const nodeEnv of ["development", "production"] as const) {
      const report = validateEnvironment({
        ...fullProduction,
        NODE_ENV: nodeEnv,
        GEMINI_API_KEY: undefined,
      });
      expect(report.errors).toEqual([]);
      expect(report.warnings.join("\n")).toContain("GEMINI_API_KEY");
    }
  });

  it("boots a minimal production deployment (database + auth secret only) with warnings", () => {
    const report = validateEnvironment({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/lifeos",
      AUTH_SECRET: "a-test-signing-secret",
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("requires Upstash at boot on strict production deployments (auth rate limiting)", () => {
    const report = validateEnvironment({
      NODE_ENV: "production",
      VERCEL: "1",
      DATABASE_URL: "postgresql://user:pass@ep-example.eu-central-1.aws.neon.tech/lifeos",
      AUTH_SECRET: "a-test-signing-secret",
    });
    expect(report.errors.join("\n")).toContain("UPSTASH_REDIS_REST_URL");
  });

  it("treats a fully unconfigured aiand selection as a warning, not an error", () => {
    const report = validateEnvironment({
      ...fullProduction,
      AI_PROVIDER: "aiand",
      GEMINI_API_KEY: undefined,
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.join("\n")).toContain("aiand");
  });

  it("treats empty strings from .env files as missing", () => {
    const report = validateEnvironment({
      ...fullProduction,
      NODE_ENV: "development",
      GEMINI_API_KEY: "   ",
    });
    expect(report.warnings.join("\n")).toContain("GEMINI_API_KEY");
  });

  it("requires base URL and model for the aiand provider", () => {
    const report = validateEnvironment({
      ...fullProduction,
      AI_PROVIDER: "aiand",
      AIAND_API_KEY: "key",
    });
    expect(report.errors.join("\n")).toContain("AIAND_BASE_URL");
    expect(report.errors.join("\n")).toContain("AI_MODEL");
  });

  it("flags partially configured Upstash Redis as an error in every environment", () => {
    const report = validateEnvironment({
      ...fullProduction,
      NODE_ENV: "development",
      UPSTASH_REDIS_REST_TOKEN: undefined,
    });
    expect(report.errors.join("\n")).toContain("UPSTASH_REDIS_REST_TOKEN");
  });

  it("flags partially configured R2 as an error and lists the missing variables", () => {
    const report = validateEnvironment({
      ...fullProduction,
      R2_SECRET_ACCESS_KEY: undefined,
      R2_BUCKET_NAME: undefined,
    });
    const message = report.errors.join("\n");
    expect(message).toContain("R2_SECRET_ACCESS_KEY");
    expect(message).toContain("R2_BUCKET_NAME");
  });

  it("downgrades missing optional services to warnings in development", () => {
    const report = validateEnvironment({
      NODE_ENV: "development",
      DATABASE_URL: "postgresql://postgres:postgres@127.0.0.1:54322/lifeos",
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.length).toBeGreaterThanOrEqual(3);
  });

  it("errors in production when AUTH_SECRET is missing, warns in development", () => {
    const prod = validateEnvironment({ ...fullProduction, AUTH_SECRET: undefined });
    expect(prod.errors.join("\n")).toContain("AUTH_SECRET");

    const dev = validateEnvironment({
      ...fullProduction,
      NODE_ENV: "development",
      AUTH_SECRET: undefined,
    });
    expect(dev.errors).toEqual([]);
    expect(dev.warnings.join("\n")).toContain("AUTH_SECRET");
  });

  it("flags partially configured OAuth providers as an error in every environment", () => {
    const report = validateEnvironment({
      ...fullProduction,
      NODE_ENV: "development",
      GOOGLE_CLIENT_SECRET: undefined,
    });
    expect(report.errors.join("\n")).toContain("GOOGLE_CLIENT_SECRET");
  });

  it("only warns when no OAuth provider is configured at all", () => {
    const report = validateEnvironment({
      ...fullProduction,
      GOOGLE_CLIENT_ID: undefined,
      GOOGLE_CLIENT_SECRET: undefined,
    });
    expect(report.errors).toEqual([]);
    expect(report.warnings.join("\n")).toContain("OAuth");
  });

  it("reports malformed values as errors", () => {
    const report = validateEnvironment({ ...fullProduction, AIAND_BASE_URL: "not-a-url" });
    expect(report.errors.length).toBeGreaterThan(0);
    expect(report.errors.join("\n")).toContain("AIAND_BASE_URL");
  });
});
