import type { AICompletionRequest, AICompletionResult, AIStreamEvent } from "./types";

/**
 * The single interface every AI vendor adapter implements.
 *
 * Rules:
 * - Business logic never imports a concrete provider; it calls
 *   `getAIProvider()` from the gateway.
 * - Adapters throw `AIProviderError` for transport/vendor failures so the
 *   gateway can decide about retries uniformly.
 */
export interface AIProvider {
  readonly name: string;
  readonly defaultModel: string;

  /** Single-shot completion (optionally with tool calls). */
  complete(request: AICompletionRequest): Promise<AICompletionResult>;

  /**
   * Streaming completion. Text arrives as incremental "text-delta" events;
   * accumulated tool calls and the terminal "finish" event arrive at the end.
   */
  stream(request: AICompletionRequest): AsyncIterable<AIStreamEvent>;
}
