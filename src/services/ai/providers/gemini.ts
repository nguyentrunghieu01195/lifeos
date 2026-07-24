import { AIProviderError } from "@/lib/errors";
import { getEnv, requireServerEnv } from "@/lib/env";

import type { AIProvider } from "../provider";
import { parseSSEStream } from "../sse";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIFinishReason,
  AIStreamEvent,
  AIToolCall,
  AIUsage,
  FetchLike,
} from "../types";

/**
 * Native adapter for the Google Gemini API (generativelanguage.googleapis.com).
 * Implemented against the stable v1beta REST surface with plain fetch — no SDK —
 * so the adapter has zero dependencies and full control over streaming.
 */

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";

// --- Wire types (subset we rely on) -----------------------------------------

type GeminiPart =
  | { text: string }
  | { functionCall: { name: string; args?: Record<string, unknown> } }
  | { functionResponse: { name: string; response: Record<string, unknown> } };

interface GeminiContent {
  role: "user" | "model";
  parts: GeminiPart[];
}

interface GeminiRequestBody {
  contents: GeminiContent[];
  systemInstruction?: { parts: Array<{ text: string }> };
  tools?: Array<{ functionDeclarations: Array<Record<string, unknown>> }>;
  generationConfig?: Record<string, unknown>;
}

interface GeminiResponseBody {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
    finishReason?: string;
  }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  modelVersion?: string;
}

// --- Pure mapping helpers (unit tested) --------------------------------------

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: value };
  }
}

export function toGeminiRequest(request: AICompletionRequest): GeminiRequestBody {
  const systemTexts: string[] = [];
  const contents: GeminiContent[] = [];

  for (const message of request.messages) {
    switch (message.role) {
      case "system":
        systemTexts.push(message.content);
        break;
      case "user":
        contents.push({ role: "user", parts: [{ text: message.content }] });
        break;
      case "assistant": {
        const parts: GeminiPart[] = [];
        if (message.content.length > 0) parts.push({ text: message.content });
        for (const call of message.toolCalls ?? []) {
          parts.push({
            functionCall: { name: call.name, args: parseJsonObject(call.arguments) },
          });
        }
        if (parts.length > 0) contents.push({ role: "model", parts });
        break;
      }
      case "tool":
        contents.push({
          role: "user",
          parts: [
            {
              functionResponse: {
                name: message.name ?? "tool",
                response: parseJsonObject(message.content),
              },
            },
          ],
        });
        break;
    }
  }

  const generationConfig: Record<string, unknown> = {};
  if (request.temperature !== undefined) generationConfig.temperature = request.temperature;
  if (request.maxOutputTokens !== undefined) {
    generationConfig.maxOutputTokens = request.maxOutputTokens;
  }
  if (request.jsonMode) generationConfig.responseMimeType = "application/json";

  const body: GeminiRequestBody = { contents };
  if (systemTexts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemTexts.join("\n\n") }] };
  }
  if (request.tools && request.tools.length > 0) {
    body.tools = [
      {
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        })),
      },
    ];
  }
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;
  return body;
}

export function mapGeminiFinishReason(
  reason: string | undefined,
  hasToolCalls: boolean,
): AIFinishReason {
  switch (reason) {
    case "STOP":
      return hasToolCalls ? "tool_calls" : "stop";
    case "MAX_TOKENS":
      return "length";
    case "SAFETY":
    case "PROHIBITED_CONTENT":
    case "BLOCKLIST":
      return "content_filter";
    case undefined:
      return "unknown";
    default:
      return "unknown";
  }
}

export function extractGeminiParts(body: GeminiResponseBody): {
  text: string;
  toolCalls: AIToolCall[];
  finishReason?: string;
  usage?: AIUsage;
} {
  const candidate = body.candidates?.[0];
  let text = "";
  const toolCalls: AIToolCall[] = [];

  for (const part of candidate?.content?.parts ?? []) {
    if ("text" in part) {
      text += part.text;
    } else if ("functionCall" in part) {
      toolCalls.push({
        id: `call_${crypto.randomUUID()}`,
        name: part.functionCall.name,
        arguments: JSON.stringify(part.functionCall.args ?? {}),
      });
    }
  }

  const usage = body.usageMetadata
    ? {
        inputTokens: body.usageMetadata.promptTokenCount ?? 0,
        outputTokens: body.usageMetadata.candidatesTokenCount ?? 0,
      }
    : undefined;

  return {
    text,
    toolCalls,
    ...(candidate?.finishReason !== undefined ? { finishReason: candidate.finishReason } : {}),
    ...(usage ? { usage } : {}),
  };
}

// --- Provider ----------------------------------------------------------------

export interface GeminiProviderConfig {
  apiKey: string;
  defaultModel: string;
  fetchImpl?: FetchLike;
}

export class GeminiProvider implements AIProvider {
  readonly name = "gemini";
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: GeminiProviderConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get defaultModel(): string {
    return this.config.defaultModel;
  }

  private async request(request: AICompletionRequest, streaming: boolean): Promise<Response> {
    const model = request.model ?? this.config.defaultModel;
    const method = streaming ? "streamGenerateContent?alt=sse" : "generateContent";
    const response = await this.fetchImpl(`${GEMINI_BASE_URL}/models/${model}:${method}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": this.config.apiKey,
      },
      body: JSON.stringify(toGeminiRequest(request)),
      ...(request.signal ? { signal: request.signal } : {}),
    });

    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      throw new AIProviderError(
        `gemini request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        {
          provider: "gemini",
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        },
      );
    }
    return response;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const response = await this.request(request, false);
    const body = (await response.json()) as GeminiResponseBody;
    const { text, toolCalls, finishReason, usage } = extractGeminiParts(body);

    return {
      text,
      toolCalls,
      finishReason: mapGeminiFinishReason(finishReason, toolCalls.length > 0),
      ...(usage ? { usage } : {}),
      model: body.modelVersion ?? request.model ?? this.config.defaultModel,
      provider: this.name,
    };
  }

  async *stream(request: AICompletionRequest): AsyncIterable<AIStreamEvent> {
    const response = await this.request(request, true);
    if (!response.body) {
      throw new AIProviderError("gemini returned an empty stream body", { provider: "gemini" });
    }

    const pendingToolCalls: AIToolCall[] = [];
    let finishReason: string | undefined;
    let usage: AIUsage | undefined;

    for await (const data of parseSSEStream(response.body)) {
      let chunk: GeminiResponseBody;
      try {
        chunk = JSON.parse(data) as GeminiResponseBody;
      } catch {
        continue;
      }

      const extracted = extractGeminiParts(chunk);
      if (extracted.text.length > 0) {
        yield { type: "text-delta", text: extracted.text };
      }
      pendingToolCalls.push(...extracted.toolCalls);
      if (extracted.finishReason !== undefined) finishReason = extracted.finishReason;
      if (extracted.usage) usage = extracted.usage;
    }

    for (const toolCall of pendingToolCalls) {
      yield { type: "tool-call", toolCall };
    }
    yield {
      type: "finish",
      finishReason: mapGeminiFinishReason(finishReason, pendingToolCalls.length > 0),
      ...(usage ? { usage } : {}),
    };
  }
}

export function createGeminiProvider(fetchImpl?: FetchLike): AIProvider {
  const apiKey = requireServerEnv(
    "GEMINI_API_KEY",
    "Create one at https://aistudio.google.com/apikey.",
  );
  return new GeminiProvider({
    apiKey,
    defaultModel: getEnv().AI_MODEL ?? GEMINI_DEFAULT_MODEL,
    ...(fetchImpl ? { fetchImpl } : {}),
  });
}

async function safeErrorDetail(response: Response): Promise<string | null> {
  try {
    const text = await response.text();
    try {
      const parsed = JSON.parse(text) as { error?: { message?: string } };
      if (parsed.error?.message) return parsed.error.message;
    } catch {
      // Not JSON — fall through to raw text.
    }
    return text.slice(0, 300) || null;
  } catch {
    return null;
  }
}
