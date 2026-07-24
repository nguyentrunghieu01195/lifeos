import { AIProviderError } from "@/lib/errors";

import type { AIProvider } from "../provider";
import { parseSSEStream } from "../sse";
import type {
  AICompletionRequest,
  AICompletionResult,
  AIFinishReason,
  AIMessage,
  AIStreamEvent,
  AIToolCall,
  AIUsage,
  FetchLike,
} from "../types";

/**
 * Shared adapter for every provider that exposes the OpenAI Chat Completions
 * wire format. Groq uses it with a fixed base URL; AIAND uses it with a
 * user-configured endpoint. Adding another OpenAI-compatible vendor is a
 * ~10 line factory, not a new implementation.
 */

export interface OpenAICompatibleConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  defaultModel: string;
  fetchImpl?: FetchLike;
}

// --- Wire types (subset we rely on) -----------------------------------------

interface WireMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: WireToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface WireCompletion {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: WireToolCall[] };
    finish_reason?: string | null;
  }>;
  usage?: WireUsage;
}

interface WireStreamChunk {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason?: string | null;
  }>;
  usage?: WireUsage | null;
  x_groq?: { usage?: WireUsage };
}

// --- Pure mapping helpers (unit tested) --------------------------------------

export function toOpenAIMessages(messages: AIMessage[]): WireMessage[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool" as const,
        content: message.content,
        tool_call_id: message.toolCallId ?? "",
        ...(message.name ? { name: message.name } : {}),
      };
    }
    if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: "assistant" as const,
        content: message.content.length > 0 ? message.content : null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function" as const,
          function: { name: call.name, arguments: call.arguments },
        })),
      };
    }
    return { role: message.role, content: message.content };
  });
}

export function buildChatCompletionBody(
  request: AICompletionRequest,
  defaultModel: string,
  stream: boolean,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: request.model ?? defaultModel,
    messages: toOpenAIMessages(request.messages),
    stream,
  };
  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (request.maxOutputTokens !== undefined) body.max_tokens = request.maxOutputTokens;
  if (request.jsonMode) body.response_format = { type: "json_object" };
  if (request.tools && request.tools.length > 0) {
    body.tools = request.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }
  return body;
}

export function mapOpenAIFinishReason(
  reason: string | null | undefined,
  hasToolCalls: boolean,
): AIFinishReason {
  switch (reason) {
    case "stop":
      return hasToolCalls ? "tool_calls" : "stop";
    case "length":
      return "length";
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "content_filter":
      return "content_filter";
    default:
      return "unknown";
  }
}

function mapUsage(usage: WireUsage | null | undefined): AIUsage | undefined {
  if (!usage) return undefined;
  return {
    inputTokens: usage.prompt_tokens ?? 0,
    outputTokens: usage.completion_tokens ?? 0,
  };
}

// --- Provider ----------------------------------------------------------------

export class OpenAICompatibleProvider implements AIProvider {
  private readonly fetchImpl: FetchLike;

  constructor(private readonly config: OpenAICompatibleConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  get name(): string {
    return this.config.name;
  }

  get defaultModel(): string {
    return this.config.defaultModel;
  }

  private async request(body: Record<string, unknown>, signal?: AbortSignal): Promise<Response> {
    const baseUrl = this.config.baseUrl.replace(/\/$/, "");
    const response = await this.fetchImpl(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      const detail = await safeErrorDetail(response);
      throw new AIProviderError(
        `${this.config.name} request failed (${response.status})${detail ? `: ${detail}` : ""}`,
        {
          provider: this.config.name,
          status: response.status,
          retryable: response.status === 429 || response.status >= 500,
        },
      );
    }
    return response;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResult> {
    const body = buildChatCompletionBody(request, this.config.defaultModel, false);
    const response = await this.request(body, request.signal);
    const completion = (await response.json()) as WireCompletion;

    const choice = completion.choices?.[0];
    const toolCalls: AIToolCall[] = (choice?.message?.tool_calls ?? []).map((call) => ({
      id: call.id,
      name: call.function.name,
      arguments: call.function.arguments,
    }));

    return {
      text: choice?.message?.content ?? "",
      toolCalls,
      finishReason: mapOpenAIFinishReason(choice?.finish_reason, toolCalls.length > 0),
      usage: mapUsage(completion.usage),
      model: completion.model ?? request.model ?? this.config.defaultModel,
      provider: this.config.name,
    };
  }

  async *stream(request: AICompletionRequest): AsyncIterable<AIStreamEvent> {
    const body = buildChatCompletionBody(request, this.config.defaultModel, true);
    // Ask for usage on the final chunk where supported (OpenAI, Groq).
    body.stream_options = { include_usage: true };

    const response = await this.request(body, request.signal);
    if (!response.body) {
      throw new AIProviderError(`${this.config.name} returned an empty stream body`, {
        provider: this.config.name,
      });
    }

    const pendingToolCalls = new Map<
      number,
      { id: string; name: string; argumentChunks: string[] }
    >();
    let finishReason: AIFinishReason = "unknown";
    let sawFinish = false;
    let usage: AIUsage | undefined;

    for await (const data of parseSSEStream(response.body)) {
      if (data === "[DONE]") break;

      let chunk: WireStreamChunk;
      try {
        chunk = JSON.parse(data) as WireStreamChunk;
      } catch {
        // Skip malformed keep-alive frames rather than killing the stream.
        continue;
      }

      const chunkUsage = mapUsage(chunk.usage ?? chunk.x_groq?.usage);
      if (chunkUsage) usage = chunkUsage;

      const choice = chunk.choices?.[0];
      if (!choice) continue;

      const delta = choice.delta;
      if (delta?.content) {
        yield { type: "text-delta", text: delta.content };
      }
      for (const toolDelta of delta?.tool_calls ?? []) {
        const existing = pendingToolCalls.get(toolDelta.index);
        if (existing) {
          if (toolDelta.function?.arguments) {
            existing.argumentChunks.push(toolDelta.function.arguments);
          }
          if (toolDelta.function?.name) existing.name = toolDelta.function.name;
          if (toolDelta.id) existing.id = toolDelta.id;
        } else {
          pendingToolCalls.set(toolDelta.index, {
            id: toolDelta.id ?? `call_${toolDelta.index}`,
            name: toolDelta.function?.name ?? "",
            argumentChunks: toolDelta.function?.arguments ? [toolDelta.function.arguments] : [],
          });
        }
      }
      if (choice.finish_reason) {
        sawFinish = true;
        finishReason = mapOpenAIFinishReason(choice.finish_reason, pendingToolCalls.size > 0);
      }
    }

    for (const [, pending] of [...pendingToolCalls.entries()].sort(([a], [b]) => a - b)) {
      yield {
        type: "tool-call",
        toolCall: {
          id: pending.id,
          name: pending.name,
          arguments: pending.argumentChunks.join(""),
        },
      };
    }

    yield {
      type: "finish",
      finishReason: sawFinish ? finishReason : pendingToolCalls.size > 0 ? "tool_calls" : "stop",
      ...(usage ? { usage } : {}),
    };
  }
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
