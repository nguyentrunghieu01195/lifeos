import { describe, expect, it } from "vitest";

import {
  extractGeminiParts,
  GeminiProvider,
  mapGeminiFinishReason,
  toGeminiRequest,
} from "@/services/ai/providers/gemini";
import type { FetchLike } from "@/services/ai/types";

describe("toGeminiRequest", () => {
  it("hoists system messages into a joined systemInstruction", () => {
    const body = toGeminiRequest({
      messages: [
        { role: "system", content: "You are LifeOS." },
        { role: "system", content: "Be concise." },
        { role: "user", content: "Hi" },
      ],
    });
    expect(body.systemInstruction).toEqual({
      parts: [{ text: "You are LifeOS.\n\nBe concise." }],
    });
    expect(body.contents).toEqual([{ role: "user", parts: [{ text: "Hi" }] }]);
  });

  it("maps assistant tool calls to functionCall parts with parsed args", () => {
    const body = toGeminiRequest({
      messages: [
        {
          role: "assistant",
          content: "Creating it now.",
          toolCalls: [{ id: "call_1", name: "create_task", arguments: '{"title":"Milk"}' }],
        },
      ],
    });
    expect(body.contents).toEqual([
      {
        role: "model",
        parts: [
          { text: "Creating it now." },
          { functionCall: { name: "create_task", args: { title: "Milk" } } },
        ],
      },
    ]);
  });

  it("wraps non-object tool results so functionResponse always receives an object", () => {
    const body = toGeminiRequest({
      messages: [{ role: "tool", content: "42", name: "count_tasks", toolCallId: "call_1" }],
    });
    expect(body.contents).toEqual([
      {
        role: "user",
        parts: [{ functionResponse: { name: "count_tasks", response: { result: 42 } } }],
      },
    ]);
  });

  it("maps tools, jsonMode and generation options", () => {
    const body = toGeminiRequest({
      messages: [{ role: "user", content: "Hi" }],
      tools: [{ name: "create_task", description: "Create", parameters: { type: "object" } }],
      jsonMode: true,
      temperature: 0.1,
      maxOutputTokens: 256,
    });
    expect(body.tools).toEqual([
      {
        functionDeclarations: [
          { name: "create_task", description: "Create", parameters: { type: "object" } },
        ],
      },
    ]);
    expect(body.generationConfig).toEqual({
      temperature: 0.1,
      maxOutputTokens: 256,
      responseMimeType: "application/json",
    });
  });
});

describe("extractGeminiParts", () => {
  it("concatenates text parts and converts functionCall parts to tool calls", () => {
    const extracted = extractGeminiParts({
      candidates: [
        {
          content: {
            parts: [
              { text: "Sure — " },
              { functionCall: { name: "create_task", args: { title: "Milk" } } },
            ],
          },
          finishReason: "STOP",
        },
      ],
      usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 5 },
    });

    expect(extracted.text).toBe("Sure — ");
    expect(extracted.toolCalls).toHaveLength(1);
    expect(extracted.toolCalls[0]?.name).toBe("create_task");
    expect(extracted.toolCalls[0]?.id).toMatch(/^call_/);
    expect(JSON.parse(extracted.toolCalls[0]?.arguments ?? "{}")).toEqual({ title: "Milk" });
    expect(extracted.usage).toEqual({ inputTokens: 9, outputTokens: 5 });
    expect(extracted.finishReason).toBe("STOP");
  });
});

describe("mapGeminiFinishReason", () => {
  it("maps vendor reasons to the gateway contract", () => {
    expect(mapGeminiFinishReason("STOP", false)).toBe("stop");
    expect(mapGeminiFinishReason("STOP", true)).toBe("tool_calls");
    expect(mapGeminiFinishReason("MAX_TOKENS", false)).toBe("length");
    expect(mapGeminiFinishReason("SAFETY", false)).toBe("content_filter");
    expect(mapGeminiFinishReason(undefined, false)).toBe("unknown");
  });
});

describe("GeminiProvider.complete", () => {
  it("calls generateContent with the x-goog-api-key header and maps the response", async () => {
    const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
    const fetchImpl: FetchLike = async (input, init) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      calls.push({ url, init });
      return new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: "Hi " }, { text: "there" }] }, finishReason: "STOP" },
          ],
          usageMetadata: { promptTokenCount: 7, candidatesTokenCount: 3 },
          modelVersion: "gemini-2.5-flash",
        }),
        { status: 200 },
      );
    };

    const provider = new GeminiProvider({
      apiKey: "test-key",
      defaultModel: "gemini-2.5-flash",
      fetchImpl,
    });
    const result = await provider.complete({ messages: [{ role: "user", content: "Hello" }] });

    expect(calls[0]?.url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    );
    const headers = calls[0]?.init?.headers as Record<string, string>;
    expect(headers["x-goog-api-key"]).toBe("test-key");

    expect(result).toEqual({
      text: "Hi there",
      toolCalls: [],
      finishReason: "stop",
      usage: { inputTokens: 7, outputTokens: 3 },
      model: "gemini-2.5-flash",
      provider: "gemini",
    });
  });
});
