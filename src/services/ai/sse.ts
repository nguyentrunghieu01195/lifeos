/**
 * Minimal Server-Sent-Events parser for AI provider streams.
 *
 * Yields the joined `data:` payload of each event. Handles chunk boundaries
 * that split events, CRLF newlines, and multi-line data fields. Comment lines
 * (`: keepalive`) and other SSE fields are ignored — AI providers only use
 * `data:` frames.
 */
export async function* parseSSEStream(
  stream: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, undefined> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const extractData = (rawEvent: string): string | null => {
    const dataLines = rawEvent
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).replace(/^ /, ""));
    return dataLines.length > 0 ? dataLines.join("\n") : null;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // SSE data payloads never contain raw newlines (each line is its own
      // `data:` field), so normalizing CRLF at the buffer level is safe.
      buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        const data = extractData(rawEvent);
        if (data !== null) yield data;
      }
    }

    // Flush a trailing event when the stream ends without a blank line.
    buffer += decoder.decode();
    const tail = extractData(buffer);
    if (tail !== null) yield tail;
  } finally {
    reader.releaseLock();
  }
}
