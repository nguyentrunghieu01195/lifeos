# ADR 0004 — Environment validation: lazy access, strict boot in production

**Status:** Accepted · **Phase:** 1

## Context

LifeOS depends on several external services (Postgres, Upstash, R2, one of three AI providers). Requirements conflict:

1. `next build` must succeed without secrets (CI, forks, previews).
2. A misconfigured production deploy must fail **at boot** with a readable report — not per-request at 2am.
3. Development should run with the minimum (a database) and degrade gracefully elsewhere.

## Decision

Three cooperating mechanisms in `src/lib/env.ts`:

1. **Schema (Zod)** — every service variable is _optional but format-checked_; empty strings from `.env` files are treated as unset. Parsed once, memoized.
2. **Point-of-use guards** — services read variables via `requireServerEnv(key, hint)` and throw a typed `NotConfiguredError` naming the exact variable. Clients are created lazily (db, redis, R2, AI providers), so imports never crash builds.
3. **Boot validation** — `src/instrumentation.ts` runs `assertBootEnvironment()` on server start (skipped during build):
   - **Strict** on Vercel production (`VERCEL=1`) or when `ENFORCE_ENV_VALIDATION=true`: throws with the full error report.
   - Otherwise logs errors/warnings and continues.
     Cross-variable rules live here: provider key must match `AI_PROVIDER`; AIAND requires base URL + model; partially configured Upstash/R2 is always an error (worse than absent); Redis/R2 are production-required, development-optional.

## Consequences

- One file owns the environment contract; `.env.example` documents it for humans and the validation report names variables verbatim.
- Development rate limiting falls back to an in-memory sliding window with a logged warning; production without Redis refuses to limp along silently.
- Tests cover the rules as pure functions (`validateEnvironment(source)`).
