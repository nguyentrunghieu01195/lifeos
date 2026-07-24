/**
 * Application error hierarchy.
 *
 * Every layer of LifeOS throws typed errors from this module so that route
 * handlers, server actions and the AI gateway can translate failures into
 * consistent HTTP responses and user-facing messages without string matching.
 */

export type AppErrorCode =
  | "INTERNAL"
  | "VALIDATION"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_CONFIGURED"
  | "RATE_LIMITED"
  | "AI_PROVIDER";

export interface AppErrorOptions {
  code?: AppErrorCode;
  /** HTTP status this error maps to at the transport boundary. */
  status?: number;
  cause?: unknown;
}

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;

  constructor(message: string, options: AppErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = options.code ?? "INTERNAL";
    this.status = options.status ?? 500;
  }
}

/**
 * A required external service (database, Redis, R2, AI provider) is missing
 * configuration. The message always names the exact environment variables to set.
 */
export class NotConfiguredError extends AppError {
  constructor(message: string, options: Omit<AppErrorOptions, "code" | "status"> = {}) {
    super(message, { ...options, code: "NOT_CONFIGURED", status: 503 });
  }
}

export class RateLimitError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message, { code: "RATE_LIMITED", status: 429 });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface AIProviderErrorOptions extends Omit<AppErrorOptions, "code"> {
  provider: string;
  /** Whether the gateway may retry the request (rate limits, transient 5xx). */
  retryable?: boolean;
}

export class AIProviderError extends AppError {
  readonly provider: string;
  readonly retryable: boolean;

  constructor(message: string, options: AIProviderErrorOptions) {
    super(message, { code: "AI_PROVIDER", status: options.status ?? 502, cause: options.cause });
    this.provider = options.provider;
    this.retryable = options.retryable ?? false;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
