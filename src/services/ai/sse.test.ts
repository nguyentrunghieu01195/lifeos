import { describe, expect, it } from "vitest";

import { parseSSEStream } from "@/services/ai/sse";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const results: string[] = [];
  for await (const data of parseSSEStream(stream)) {
    results.push(data);
  }
  return results;
}

describe("parseSSEStream", () => {
  it("parses multiple events in a single chunk", async () => {
    const events = await collect(streamOf('data: {"a":1}\n\ndata: {"b":2}\n\n'));
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("handles events split across chunk boundaries", async () => {
    const events = await collect(streamOf('data: {"hel', 'lo":true}', "\n", "\ndata: [DONE]\n\n"));
    expect(events).toEqual(['{"hello":true}', "[DONE]"]);
  });

  it("handles CRLF line endings", async () => {
    const events = await collect(streamOf("data: one\r\n\r\ndata: two\r\n\r\n"));
    expect(events).toEqual(["one", "two"]);
  });

  it("joins multi-line data fields with newlines", async () => {
    const events = await collect(streamOf("data: line1\ndata: line2\n\n"));
    expect(events).toEqual(["line1\nline2"]);
  });

  it("ignores comments and non-data fields", async () => {
    const events = await collect(streamOf(": keepalive\n\nevent: ping\nid: 3\n\ndata: real\n\n"));
    expect(events).toEqual(["real"]);
  });

  it("flushes a trailing event when the stream ends without a blank line", async () => {
    const events = await collect(streamOf("data: tail"));
    expect(events).toEqual(["tail"]);
  });

  it("preserves payloads containing colons and spaces", async () => {
    const events = await collect(streamOf('data: {"text": "a: b"}\n\n'));
    expect(events).toEqual(['{"text": "a: b"}']);
  });
});
