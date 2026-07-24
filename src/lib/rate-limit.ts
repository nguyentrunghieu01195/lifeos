import { Ratelimit } from "@upstash/ratelimit";

import { getEnv, isStrictProduction } from "@/lib/env";
import { NotConfiguredError } from "@/lib/errors";
import { getRedis, isRedisConfigured } from "@/lib/redis";

/**
 * Rate limiting.
 *
 * Production uses Upstash sliding windows (durable across serverless
 * instances). Development and tests fall back to an in-process sliding window
 * so the app works without external services; production without Redis fails
 * fast with a NotConfiguredError instead of silently running unlimited.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  /** Epoch milliseconds when the window resets. */
  reset: number;
}

export interface RateLimiter {
  limit(identifier: string): Promise<RateLimitResult>;
}

export interface RateLimiterOptions {
  /** Namespace for the limiter, e.g. "auth", "api", "ai". */
  name: string;
  /** Maximum number of requests per window. */
  limit: number;
  windowSeconds: number;
}

class MemorySlidingWindowLimiter implements RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly options: RateLimiterOptions) {}

  async limit(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = this.options.windowSeconds * 1000;
    const cutoff = now - windowMs;

    const recent = (this.hits.get(identifier) ?? []).filter((ts) => ts > cutoff);
    const success = recent.length < this.options.limit;
    if (success) {
      recent.push(now);
    }
    this.hits.set(identifier, recent);

    const oldest = recent[0];
    return {
      success,
      limit: this.options.limit,
      remaining: Math.max(0, this.options.limit - recent.length),
      reset: (oldest ?? now) + windowMs,
    };
  }
}

class UpstashRateLimiter implements RateLimiter {
  private readonly ratelimit: Ratelimit;

  constructor(options: RateLimiterOptions) {
    this.ratelimit = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(options.limit, `${options.windowSeconds} s`),
      prefix: `lifeos:rl:${options.name}`,
      analytics: false,
    });
  }

  async limit(identifier: string): Promise<RateLimitResult> {
    const result = await this.ratelimit.limit(identifier);
    return {
      success: result.success,
      limit: result.limit,
      remaining: result.remaining,
      reset: result.reset,
    };
  }
}

let warnedMemoryFallback = false;

/**
 * Create a rate limiter. Instantiate lazily (inside the handler or a module
 * getter) rather than at module top level so configuration errors surface as
 * request-scoped 503s instead of import-time crashes.
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
  if (isRedisConfigured()) {
    return new UpstashRateLimiter(options);
  }
  // Real deployments must not run with per-instance limits; CI and local
  // production builds degrade to the in-memory window (same switch as boot
  // validation — see ADR 0004).
  if (isStrictProduction()) {
    throw new NotConfiguredError(
      "Rate limiting requires Upstash Redis in production. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
    );
  }
  if (!warnedMemoryFallback && getEnv().NODE_ENV !== "test") {
    console.warn(
      "[rate-limit] Upstash Redis not configured — using an in-memory, per-instance rate limiter. Do not ship real traffic like this.",
    );
    warnedMemoryFallback = true;
  }
  return new MemorySlidingWindowLimiter(options);
}

/** Exported for unit tests. */
export function createMemoryRateLimiter(options: RateLimiterOptions): RateLimiter {
  return new MemorySlidingWindowLimiter(options);
}
