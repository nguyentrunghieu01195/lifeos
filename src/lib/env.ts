import { z } from "zod";

import { NotConfiguredError } from "@/lib/errors";

/**
 * Environment configuration.
 *
 * Design (see docs/adr/0004-environment-validation.md):
 * - The schema treats every service variable as optional so that `next build`
 *   succeeds on machines without secrets (CI, preview environments).
 * - Services access variables through `requireServerEnv`, which throws a typed
 *   `NotConfiguredError` naming the exact variable and how to set it.
 * - `assertBootEnvironment` runs at server start (src/instrumentation.ts) and
 *   enforces the full contract strictly on production deployments.
 */

/** Coerce empty strings from .env files ("KEY=") into undefined. */
const optionalString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional(),
);

export const AI_PROVIDER_IDS = ["gemini", "groq", "aiand"] as const;
export type AIProviderId = (typeof AI_PROVIDER_IDS)[number];

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: optionalUrl,

  DATABASE_URL: optionalUrl,
  DATABASE_DRIVER: z.enum(["neon", "pg"]).optional(),

  AUTH_SECRET: optionalString,
  AUTH_URL: optionalUrl,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  GITHUB_CLIENT_ID: optionalString,
  GITHUB_CLIENT_SECRET: optionalString,

  AI_PROVIDER: z.enum(AI_PROVIDER_IDS).default("gemini"),
  AI_MODEL: optionalString,
  GEMINI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  AIAND_API_KEY: optionalString,
  AIAND_BASE_URL: optionalUrl,

  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: optionalString,

  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_BASE_URL: optionalUrl,

  ENFORCE_ENV_VALIDATION: z.enum(["true", "false"]).optional(),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

function parseEnv(source: NodeJS.ProcessEnv): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export function getEnv(): Env {
  cachedEnv ??= parseEnv(process.env);
  return cachedEnv;
}

/** Test helper — forces the next getEnv() call to re-read process.env. */
export function resetEnvCache(): void {
  cachedEnv = null;
}

type RequiredEnvKey = {
  [K in keyof Env]-?: undefined extends Env[K] ? K : never;
}[keyof Env];

/**
 * Read an optional environment variable and fail with a typed, actionable
 * error when it is missing. Used by every service at the point of first use.
 */
export function requireServerEnv<K extends RequiredEnvKey>(
  key: K,
  hint?: string,
): NonNullable<Env[K]> {
  const value = getEnv()[key];
  if (value === undefined) {
    throw new NotConfiguredError(
      `Missing required environment variable ${key}.${hint ? ` ${hint}` : ""} See .env.example.`,
    );
  }
  return value as NonNullable<Env[K]>;
}

export interface EnvReport {
  errors: string[];
  warnings: string[];
}

const AI_KEY_BY_PROVIDER: Record<AIProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  aiand: "AIAND_API_KEY",
};

/**
 * Validate the full environment contract. Pure function over a plain env
 * object so the rules are unit-testable.
 */
export function validateEnvironment(source: NodeJS.ProcessEnv = process.env): EnvReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  let env: Env;
  try {
    env = parseEnv(source);
  } catch (error) {
    return { errors: [error instanceof Error ? error.message : String(error)], warnings: [] };
  }

  const isProd = env.NODE_ENV === "production";
  const requireOrWarn = (condition: boolean, message: string) => {
    if (!condition) return;
    if (isProd) {
      errors.push(message);
    } else {
      warnings.push(message);
    }
  };

  if (!env.DATABASE_URL) {
    errors.push("DATABASE_URL is not set — the app cannot reach PostgreSQL.");
  }

  requireOrWarn(
    !env.AUTH_SECRET,
    "AUTH_SECRET is not set — sessions cannot be signed. Generate one with `openssl rand -base64 32`.",
  );
  const oauthPairs: Array<[string, string | undefined, string, string | undefined]> = [
    ["GOOGLE_CLIENT_ID", env.GOOGLE_CLIENT_ID, "GOOGLE_CLIENT_SECRET", env.GOOGLE_CLIENT_SECRET],
    ["GITHUB_CLIENT_ID", env.GITHUB_CLIENT_ID, "GITHUB_CLIENT_SECRET", env.GITHUB_CLIENT_SECRET],
  ];
  for (const [idName, id, secretName, secret] of oauthPairs) {
    if (Boolean(id) !== Boolean(secret)) {
      errors.push(`OAuth provider partially configured — set both ${idName} and ${secretName}.`);
    }
  }
  if (!env.GOOGLE_CLIENT_ID && !env.GITHUB_CLIENT_ID) {
    warnings.push("No OAuth providers configured — only email/password sign-in will be offered.");
  }

  // Optional services below are WARNINGS while absent — they become required
  // in the phase that ships their consuming feature (AI chat, caching-critical
  // views, document storage). Partial configuration is always an error: it is
  // a mistake, not a choice.
  if (env.AI_PROVIDER === "aiand") {
    const aiandParts: Array<[string, string | undefined]> = [
      ["AIAND_API_KEY", env.AIAND_API_KEY],
      ["AIAND_BASE_URL", env.AIAND_BASE_URL],
      ["AI_MODEL", env.AI_MODEL],
    ];
    const missing = aiandParts.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length === aiandParts.length) {
      warnings.push('AI_PROVIDER is "aiand" but it is not configured — AI features will fail.');
    } else if (missing.length > 0) {
      errors.push(`AIAND is partially configured — missing ${missing.join(", ")}.`);
    }
  } else {
    const requiredAIKey = AI_KEY_BY_PROVIDER[env.AI_PROVIDER];
    const hasAIKey = Boolean(env.AI_PROVIDER === "gemini" ? env.GEMINI_API_KEY : env.GROQ_API_KEY);
    if (!hasAIKey) {
      warnings.push(
        `AI_PROVIDER is "${env.AI_PROVIDER}" but ${requiredAIKey} is not set — AI features will fail.`,
      );
    }
  }

  const upstashConfigured = [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN];
  if (upstashConfigured.some(Boolean) && !upstashConfigured.every(Boolean)) {
    errors.push(
      "Upstash Redis is partially configured — set both UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  } else if (!upstashConfigured.every(Boolean)) {
    if (isStrictProduction(source)) {
      // Auth rate limiting is a shipped consumer: per-instance windows are
      // ineffective on serverless, so real deployments must fail at boot.
      errors.push(
        "Upstash Redis is required on production deployments — auth rate limiting must be durable. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    } else {
      warnings.push(
        "Upstash Redis is not configured — rate limiting falls back to a per-instance window and caching is disabled.",
      );
    }
  }

  const r2Vars: Array<[string, string | undefined]> = [
    ["R2_ACCOUNT_ID", env.R2_ACCOUNT_ID],
    ["R2_ACCESS_KEY_ID", env.R2_ACCESS_KEY_ID],
    ["R2_SECRET_ACCESS_KEY", env.R2_SECRET_ACCESS_KEY],
    ["R2_BUCKET_NAME", env.R2_BUCKET_NAME],
  ];
  const r2Missing = r2Vars.filter(([, value]) => !value).map(([name]) => name);
  if (r2Missing.length > 0 && r2Missing.length < r2Vars.length) {
    errors.push(`Cloudflare R2 is partially configured — missing ${r2Missing.join(", ")}.`);
  } else if (r2Missing.length === r2Vars.length) {
    warnings.push(
      "Cloudflare R2 is not configured — file storage (documents, images, avatars) is unavailable.",
    );
  }

  return { errors, warnings };
}

/**
 * "Strict production" = a real deployment (Vercel) or an explicit opt-in.
 * Used by boot validation and by services that refuse to degrade on real
 * deployments but may fall back gracefully in CI / local production builds.
 */
export function isStrictProduction(source: NodeJS.ProcessEnv = process.env): boolean {
  return (
    source.NODE_ENV === "production" &&
    (source.VERCEL === "1" || source.ENFORCE_ENV_VALIDATION === "true")
  );
}

/**
 * Boot-time enforcement, called from src/instrumentation.ts.
 * Strict (throws) on Vercel production deployments or when
 * ENFORCE_ENV_VALIDATION=true; logs a readable report otherwise.
 */
export function assertBootEnvironment(): void {
  const { errors, warnings } = validateEnvironment(process.env);
  const strict = isStrictProduction();

  for (const warning of warnings) {
    console.warn(`[env] warning: ${warning}`);
  }
  if (errors.length === 0) return;

  const report = errors.map((message) => `  - ${message}`).join("\n");
  if (strict) {
    throw new Error(`Environment validation failed:\n${report}`);
  }
  console.error(`[env] validation errors (non-strict mode, continuing):\n${report}`);
}
