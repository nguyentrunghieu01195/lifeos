import { getEnv, requireServerEnv } from "@/lib/env";

import type { AIProvider } from "../provider";
import type { FetchLike } from "../types";
import { OpenAICompatibleProvider } from "./openai-compatible";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** Groq exposes the OpenAI Chat Completions format at a fixed base URL. */
export function createGroqProvider(fetchImpl?: FetchLike): AIProvider {
  const apiKey = requireServerEnv("GROQ_API_KEY", "Create one at https://console.groq.com/keys.");
  return new OpenAICompatibleProvider({
    name: "groq",
    baseUrl: GROQ_BASE_URL,
    apiKey,
    defaultModel: getEnv().AI_MODEL ?? GROQ_DEFAULT_MODEL,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}
