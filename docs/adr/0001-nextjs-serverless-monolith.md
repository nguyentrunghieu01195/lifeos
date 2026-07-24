# ADR 0001 — Next.js serverless monolith (no separate backend)

**Status:** Accepted · **Phase:** 1

## Context

LifeOS spans ~18 product modules that share one user, one data model and one AI assistant. The product must deploy to Vercel without Docker or a VPS.

## Decision

Ship a single Next.js 15 App Router application containing UI, API and background jobs:

- **React Server Components** for reads (fast first paint, no client waterfalls).
- **Server Actions** for mutations (typed, colocated with features, origin-checked).
- **Route Handlers** only where actions don't fit: streaming AI responses, presigned upload flows, webhooks, Vercel Cron.
- Feature-module folder layout (`src/features/*`) so module count scales without a service split.

## Consequences

- One deployment target, one type system end-to-end, zero service-to-service auth complexity.
- All infrastructure must be serverless-safe: Neon driver over HTTP/WebSocket (ADR 0003), Upstash over REST, R2 presigned URLs, stateless rate limiting.
- Long-running work is bounded by function limits; anything heavier (OCR, large imports) must run as queued/cron jobs — designed per feature when it arrives.
