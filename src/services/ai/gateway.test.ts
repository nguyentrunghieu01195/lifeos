import { afterEach, describe, expect, it, vi } from "vitest";

import { resetEnvCache } from "@/lib/env";
import { AIProviderError, NotConfiguredError } from "@/lib/errors";
import {
  completeWithRetry,
  createAIProvider,
  getAIProvider,
  resetAIProviderCache,
} from "@/services/ai/gateway";
import type { AIProvider } from "@/services/ai/provider";
import type { AICompletionResult, AIStreamEvent } from "@/services/ai/types";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
  resetAIProviderCache();
});

describe("createAIProvider", () => {
  it("creates the Gemini provider when its key is configured", () => {
    vi.stubEnv("GEMINI_API_KEY", "key");
    resetEnvCache();
    expect(createAIProvider("gemini").name).toBe("gemini");
  });

  it("creates the Groq provider when its key is configured", () => {
    vi.stubEnv("GROQ_API_KEY", "key");
    resetEnvCache();
    expect(createAIProvider("groq").name).toBe("groq");
  });

  it("fails with a typed error when the provider is missing configuration", () => {
    vi.stubEnv("AIAND_API_KEY", "key");
    // AIAND_BASE_URL and AI_MODEL intentionally absent.
    resetEnvCache();
    expect(() => createAIProvider("aiand")).toThrow(NotConfiguredError);
  });

  it("creates the AIAND provider when fully configured", () => {
    vi.stubEnv("AIAND_API_KEY", "key");
    vi.stubEnv("AIAND_BASE_URL", "https://api.example.com/v1");
    vi.stubEnv("AI_MODEL", "some-model");
    resetEnvCache();
    const provider = createAIProvider("aiand");
    expect(provider.name).toBe("aiand");
    expect(provider.defaultModel).toBe("some-model");
  });
});

describe("getAIProvider", () => {
  it("selects the provider from AI_PROVIDER and memoizes it", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "key");
    resetEnvCache();

    const first = getAIProvider();
    expect(first.name).toBe("groq");
    expect(getAIProvider()).toBe(first);
  });

  it("switches providers when the environment changes (no code changes)", () => {
    vi.stubEnv("AI_PROVIDER", "groq");
    vi.stubEnv("GROQ_API_KEY", "key");
    resetEnvCache();
    expect(getAIProvider().name).toBe("groq");

    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "key");
    resetEnvCache();
    expect(getAIProvider().name).toBe("gemini");
  });
});

class FlakyProvider implements AIProvider {
  readonly name = "fake";
  readonly defaultModel = "fake-1";
  attempts = 0;

  constructor(
    private readonly failuresBeforeSuccess: number,
    private readonly retryable: boolean,
  ) {}

  async complete(): Promise<AICompletionResult> {
    this.attempts += 1;
    if (this.attempts <= this.failuresBeforeSuccess) {
      throw new AIProviderError("boom", {
        provider: this.name,
        status: 429,
        retryable: this.retryable,
      });
    }
    return {
      text: "ok",
      toolCalls: [],
      finishReason: "stop",
      model: this.defaultModel,
      provider: this.name,
    };
  }

  async *stream(): AsyncIterable<AIStreamEvent> {
    yield await Promise.reject(new Error("not used in this test"));
  }
}

describe("completeWithRetry", () => {
  it("retries retryable failures with backoff and eventually succeeds", async () => {
    const provider = new FlakyProvider(2, true);
    const result = await completeWithRetry(
      { messages: [{ role: "user", content: "Hi" }] },
      { provider, retries: 2, baseDelayMs: 1 },
    );
    expect(result.text).toBe("ok");
    expect(provider.attempts).toBe(3);
  });

  it("gives up after the retry budget is exhausted", async () => {
    const provider = new FlakyProvider(10, true);
    await expect(
      completeWithRetry(
        { messages: [{ role: "user", content: "Hi" }] },
        { provider, retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(AIProviderError);
    expect(provider.attempts).toBe(3);
  });

  it("does not retry non-retryable failures", async () => {
    const provider = new FlakyProvider(10, false);
    await expect(
      completeWithRetry(
        { messages: [{ role: "user", content: "Hi" }] },
        { provider, retries: 2, baseDelayMs: 1 },
      ),
    ).rejects.toBeInstanceOf(AIProviderError);
    expect(provider.attempts).toBe(1);
  });
});
