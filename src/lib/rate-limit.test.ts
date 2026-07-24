import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMemoryRateLimiter } from "@/lib/rate-limit";

describe("in-memory sliding window rate limiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", async () => {
    const limiter = createMemoryRateLimiter({ name: "test", limit: 3, windowSeconds: 60 });

    for (let i = 0; i < 3; i++) {
      const result = await limiter.limit("user-1");
      expect(result.success).toBe(true);
    }

    const blocked = await limiter.limit("user-1");
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.limit).toBe(3);
  });

  it("tracks identifiers independently", async () => {
    const limiter = createMemoryRateLimiter({ name: "test", limit: 1, windowSeconds: 60 });

    expect((await limiter.limit("user-a")).success).toBe(true);
    expect((await limiter.limit("user-a")).success).toBe(false);
    expect((await limiter.limit("user-b")).success).toBe(true);
  });

  it("frees capacity once the window slides past old hits", async () => {
    const limiter = createMemoryRateLimiter({ name: "test", limit: 2, windowSeconds: 10 });

    expect((await limiter.limit("user-1")).success).toBe(true);
    expect((await limiter.limit("user-1")).success).toBe(true);
    expect((await limiter.limit("user-1")).success).toBe(false);

    vi.advanceTimersByTime(10_001);

    const afterWindow = await limiter.limit("user-1");
    expect(afterWindow.success).toBe(true);
  });

  it("reports a reset timestamp inside the current window", async () => {
    const limiter = createMemoryRateLimiter({ name: "test", limit: 1, windowSeconds: 30 });
    const start = Date.now();

    const result = await limiter.limit("user-1");
    expect(result.reset).toBe(start + 30_000);
  });
});
