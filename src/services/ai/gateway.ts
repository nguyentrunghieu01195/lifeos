import { getEnv, type AIProviderId } from "@/lib/env";
import { AIProviderError, AppError } from "@/lib/errors";

import type { AIProvider } from "./provider";
import { createAiandProvider } from "./providers/aiand";
import { createGeminiProvider } from "./providers/gemini";
import { createGroqProvider } from "./providers/groq";
import type { AICompletionRequest, AICompletionResult } from "./types";

/**
 * AI Gateway (docs/adr/0002-ai-gateway.md).
 *
 * The only entry point business logic uses to reach a language model:
 *
 *   const result = await completeWithRetry({ messages: [...] });
 *
 * The active provider is selected by the AI_PROVIDER environment variable —
 * switching vendors requires zero code changes.
 */

const providerFactories: Record<AIProviderId, () => AIProvider> = {
  gemini: () => createGeminiProvider(),
  groq: () => createGroqProvider(),
  aiand: () => createAiandProvider(),
};

export function createAIProvider(id: AIProviderId): AIProvider {
  const factory = providerFactories[id];
  if (!factory) {
    throw new AppError(
      `Unknown AI provider "${id as string}". Valid values: gemini, groq, aiand.`,
      {
        code: "VALIDATION",
        status: 500,
      },
    );
  }
  return factory();
}

let cachedProvider: { id: AIProviderId; provider: AIProvider } | null = null;

/** Get the active provider (memoized per AI_PROVIDER value). */
export function getAIProvider(): AIProvider {
  const id = getEnv().AI_PROVIDER;
  if (cachedProvider?.id !== id) {
    cachedProvider = { id, provider: createAIProvider(id) };
  }
  return cachedProvider.provider;
}

/** Test helper — clears the memoized provider. */
export function resetAIProviderCache(): void {
  cachedProvider = null;
}

export interface RetryOptions {
  /** Maximum number of retries after the initial attempt. Default 2. */
  retries?: number;
  /** Base backoff delay in milliseconds. Default 500. */
  baseDelayMs?: number;
  provider?: AIProvider;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Single-shot completion with bounded exponential backoff on retryable
 * provider failures (429s, transient 5xx, network errors). Streaming requests
 * intentionally have no mid-stream retry — callers restart the stream.
 */
export async function completeWithRetry(
  request: AICompletionRequest,
  options: RetryOptions = {},
): Promise<AICompletionResult> {
  const provider = options.provider ?? getAIProvider();
  const retries = options.retries ?? 2;
  const baseDelayMs = options.baseDelayMs ?? 500;

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      await sleep(baseDelayMs * 2 ** (attempt - 1) + Math.random() * 250, request.signal);
    }
    try {
      return await provider.complete(request);
    } catch (error) {
      lastError = normalizeProviderError(error, provider.name);
      if (!(lastError instanceof AIProviderError) || !lastError.retryable) {
        throw lastError;
      }
    }
  }
  throw lastError;
}

/** Wrap raw network failures so retry policy applies uniformly. */
function normalizeProviderError(error: unknown, providerName: string): unknown {
  if (error instanceof AIProviderError) return error;
  if (error instanceof DOMException && error.name === "AbortError") return error;
  if (error instanceof TypeError) {
    return new AIProviderError(`Network error calling ${providerName}: ${error.message}`, {
      provider: providerName,
      retryable: true,
      cause: error,
    });
  }
  return error;
}
