import { describe, expect, it } from "vitest";

import { AIProviderError } from "@/lib/errors";
import {
  buildChatCompletionBody,
  mapOpenAIFinishReason,
  OpenAICompatibleProvider,
  toOpenAIMessages,
} from "@/services/ai/providers/openai-compatible";
import type { AIStreamEvent, FetchLike } from "@/services/ai/types";

interface RecordedCall {
  url: string;
  init: RequestInit | undefined;
}

function stubFetch(factory: () => Response): { fetchImpl: FetchLike; calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fetchImpl: FetchLike = async (input, init) => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return factory();
  };
  return { fetchImpl, calls };
}

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(`data: ${event}\n\n`));
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

function makeProvider(fetchImpl: FetchLike) {
  return new OpenAICompatibleProvider({
    name: "groq",
    baseUrl: "https://api.groq.com/openai/v1/",
    apiKey: "test-key",
    defaultModel: "llama-3.3-70b-versatile",
    fetchImpl,
  });
}

describe("toOpenAIMessages", () => {
  it("maps plain conversation roles verbatim", () => {
    expect(
      toOpenAIMessages([
        { role: "system", content: "You are LifeOS." },
        { role: "user", content: "Hi" },
        { role: "assistant", content: "Hello!" },
      ]),
    ).toEqual([
      { role: "system", content: "You are LifeOS." },
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
    ]);
  });

  it("maps assistant tool calls and tool results to the wire format", () => {
    const mapped = toOpenAIMessages([
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "create_task", arguments: '{"title":"Milk"}' }],
      },
      { role: "tool", content: '{"ok":true}', toolCallId: "call_1", name: "create_task" },
    ]);
    expect(mapped).toEqual([
      {
        role: "assistant",
        content: null,
        tool_calls: [
          {
            id: "call_1",
            type: "function",
            function: { name: "create_task", arguments: '{"title":"Milk"}' },
          },
        ],
      },
      { role: "tool", content: '{"ok":true}', tool_call_id: "call_1", name: "create_task" },
    ]);
  });
});

describe("buildChatCompletionBody", () => {
  it("applies the default model and request options", () => {
    const body = buildChatCompletionBody(
      {
        messages: [{ role: "user", content: "Hi" }],
        temperature: 0.2,
        maxOutputTokens: 512,
        jsonMode: true,
        tools: [
          {
            name: "create_task",
            description: "Create a task",
            parameters: { type: "object", properties: {} },
          },
        ],
      },
      "llama-3.3-70b-versatile",
      false,
    );

    expect(body).toMatchObject({
      model: "llama-3.3-70b-versatile",
      stream: false,
      temperature: 0.2,
      max_tokens: 512,
      response_format: { type: "json_object" },
    });
    expect(body.tools).toEqual([
      {
        type: "function",
        function: {
          name: "create_task",
          description: "Create a task",
          parameters: { type: "object", properties: {} },
        },
      },
    ]);
  });

  it("honors per-request model overrides", () => {
    const body = buildChatCompletionBody(
      { messages: [{ role: "user", content: "Hi" }], model: "llama-3.1-8b-instant" },
      "llama-3.3-70b-versatile",
      true,
    );
    expect(body.model).toBe("llama-3.1-8b-instant");
    expect(body.stream).toBe(true);
  });
});

describe("mapOpenAIFinishReason", () => {
  it("maps wire reasons to the gateway contract", () => {
    expect(mapOpenAIFinishReason("stop", false)).toBe("stop");
    expect(mapOpenAIFinishReason("stop", true)).toBe("tool_calls");
    expect(mapOpenAIFinishReason("length", false)).toBe("length");
    expect(mapOpenAIFinishReason("tool_calls", true)).toBe("tool_calls");
    expect(mapOpenAIFinishReason("content_filter", false)).toBe("content_filter");
    expect(mapOpenAIFinishReason(null, false)).toBe("unknown");
  });
});

describe("OpenAICompatibleProvider.complete", () => {
  it("posts to /chat/completions with bearer auth and maps the response", async () => {
    const { fetchImpl, calls } = stubFetch(
      () =>
        new Response(
          JSON.stringify({
            model: "llama-3.3-70b-versatile",
            choices: [
              {
                message: {
                  content: "Done",
                  tool_calls: [
                    {
                      id: "call_9",
                      type: "function",
                      function: { name: "create_task", arguments: "{}" },
                    },
                  ],
                },
                finish_reason: "tool_calls",
              },
            ],
            usage: { prompt_tokens: 11, completion_tokens: 4 },
          }),
          { status: 200 },
        ),
    );

    const result = await makeProvider(fetchImpl).complete({
      messages: [{ role: "user", content: "Add milk to my tasks" }],
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer test-key");

    expect(result.text).toBe("Done");
    expect(result.toolCalls).toEqual([{ id: "call_9", name: "create_task", arguments: "{}" }]);
    expect(result.finishReason).toBe("tool_calls");
    expect(result.usage).toEqual({ inputTokens: 11, outputTokens: 4 });
    expect(result.provider).toBe("groq");
  });

  it("throws a retryable AIProviderError on 429s", async () => {
    const { fetchImpl } = stubFetch(
      () => new Response(JSON.stringify({ error: { message: "rate limited" } }), { status: 429 }),
    );

    const error = await makeProvider(fetchImpl)
      .complete({ messages: [{ role: "user", content: "Hi" }] })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).retryable).toBe(true);
    expect((error as AIProviderError).message).toContain("rate limited");
  });
});

describe("OpenAICompatibleProvider.stream", () => {
  it("yields text deltas, accumulated tool calls, then a finish event", async () => {
    const { fetchImpl } = stubFetch(() =>
      sseResponse([
        '{"choices":[{"delta":{"content":"Hel"}}]}',
        '{"choices":[{"delta":{"content":"lo"}}]}',
        '{"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"create_task","arguments":"{\\"title\\":"}}]}}]}',
        '{"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"Milk\\"}"}}]}}]}',
        '{"choices":[{"delta":{},"finish_reason":"tool_calls"}]}',
        '{"choices":[],"usage":{"prompt_tokens":20,"completion_tokens":8}}',
        "[DONE]",
      ]),
    );

    const events: AIStreamEvent[] = [];
    for await (const event of makeProvider(fetchImpl).stream({
      messages: [{ role: "user", content: "Add milk" }],
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: "text-delta", text: "Hel" },
      { type: "text-delta", text: "lo" },
      {
        type: "tool-call",
        toolCall: { id: "call_1", name: "create_task", arguments: '{"title":"Milk"}' },
      },
      {
        type: "finish",
        finishReason: "tool_calls",
        usage: { inputTokens: 20, outputTokens: 8 },
      },
    ]);
  });
});
