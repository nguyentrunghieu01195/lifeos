/**
 * Public surface of the AI service. Business logic imports from
 * "@/services/ai" only — never from a concrete provider module.
 */
export type { AIProvider } from "./provider";
export {
  completeWithRetry,
  createAIProvider,
  getAIProvider,
  resetAIProviderCache,
} from "./gateway";
export type {
  AICompletionRequest,
  AICompletionResult,
  AIFinishReason,
  AIMessage,
  AIRole,
  AIStreamEvent,
  AIToolCall,
  AIToolDefinition,
  AIUsage,
} from "./types";
