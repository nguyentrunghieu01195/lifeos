import { requireServerEnv } from "@/lib/env";

import type { AIProvider } from "../provider";
import type { FetchLike } from "../types";
import { OpenAICompatibleProvider } from "./openai-compatible";

/**
 * AIAND — an OpenAI-compatible endpoint configured entirely through the
 * environment. Because the concrete service behind AIAND is deployment-
 * specific, all three values are required (there is no safe default model):
 *
 *   AIAND_BASE_URL  e.g. https://api.example.com/v1
 *   AIAND_API_KEY   bearer token for that endpoint
 *   AI_MODEL        model id to request
 */
export function createAiandProvider(fetchImpl?: FetchLike): AIProvider {
  const apiKey = requireServerEnv("AIAND_API_KEY", "Bearer token for the AIAND endpoint.");
  const baseUrl = requireServerEnv(
    "AIAND_BASE_URL",
    "OpenAI-compatible base URL, e.g. https://api.example.com/v1.",
  );
  const defaultModel = requireServerEnv(
    "AI_MODEL",
    "AIAND has no default model — set the model id to use.",
  );
  return new OpenAICompatibleProvider({
    name: "aiand",
    baseUrl,
    apiKey,
    defaultModel,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}
