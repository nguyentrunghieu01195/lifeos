import { Redis } from "@upstash/redis";

import { getEnv } from "@/lib/env";
import { NotConfiguredError } from "@/lib/errors";

/**
 * Upstash Redis client (REST transport — works in serverless and edge).
 * Used for read-through caching and rate limiting.
 */

let client: Redis | null = null;

export function isRedisConfigured(): boolean {
  const env = getEnv();
  return Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);
}

export function getRedis(): Redis {
  if (!client) {
    const env = getEnv();
    if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
      throw new NotConfiguredError(
        "Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.",
      );
    }
    client = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return client;
}

/** Namespaced cache key builder: cacheKey("dashboard", userId) -> "lifeos:dashboard:<id>". */
export function cacheKey(...parts: Array<string | number>): string {
  return ["lifeos", ...parts].join(":");
}

/**
 * Read-through JSON cache. In development without Redis the compute function
 * runs uncached so the app stays fully usable; production requires Redis
 * (enforced by boot validation) so cache behavior is consistent.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  compute: () => Promise<T>,
): Promise<T> {
  if (!isRedisConfigured()) {
    return compute();
  }
  const redis = getRedis();
  const hit = await redis.get<T>(key);
  if (hit !== null && hit !== undefined) {
    return hit;
  }
  const value = await compute();
  await redis.set(key, value, { ex: ttlSeconds });
  return value;
}

/** Best-effort cache invalidation; a no-op when Redis is not configured. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!isRedisConfigured() || keys.length === 0) return;
  await getRedis().del(...keys);
}
