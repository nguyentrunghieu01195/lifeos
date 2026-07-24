# ADR 0002 — Provider-agnostic AI Gateway

**Status:** Accepted · **Phase:** 1

## Context

AI is a core feature across modules (summaries, planning, analysis, chat). Vendor pricing, quality and availability shift constantly; the product must switch providers via `AI_PROVIDER` in `.env` with **zero code changes**. Required providers: Gemini, Groq, AIAND.

## Decision

- One interface, `AIProvider` (`complete()` + `stream()`), over provider-agnostic types (`AIMessage`, `AIToolDefinition`, `AIToolCall`, `AIStreamEvent`). Tool calling is in the contract from day one because the Global AI Chat is tool-driven.
- **Groq and AIAND share `OpenAICompatibleProvider`** — both speak the OpenAI Chat Completions wire format. AIAND's concrete service is deployment-specific, so it is configured entirely via `AIAND_BASE_URL`, `AIAND_API_KEY` and `AI_MODEL` (no assumed defaults). Any future OpenAI-compatible vendor is a ~10-line factory.
- **Gemini gets a native adapter** over the stable v1beta REST surface using plain `fetch` (no SDK): full control over streaming/SSE, zero dependency churn, key sent via `x-goog-api-key` header (never in URLs/logs).
- `getAIProvider()` memoizes the adapter chosen from validated env; `completeWithRetry()` adds bounded exponential backoff with jitter for retryable failures (429, 5xx, network). Streams are never retried mid-flight — callers restart.
- Adapters accept an injectable `fetch` so mapping and streaming logic is unit-tested without network access.

## Consequences

- Business logic imports `@/services/ai` only; importing a concrete provider elsewhere is a review error.
- New capability (e.g. embeddings for semantic search) extends the interface deliberately in the phase that needs it, rather than leaking a vendor SDK.
- Per-user AI rate limiting and usage accounting attach at the gateway seam (wired in the AI Chat phase).
