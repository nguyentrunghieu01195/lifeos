# LifeOS Architecture

A single Next.js application serves every surface of LifeOS — marketing, the authenticated app, API routes and background jobs — deployed serverless on Vercel. There is intentionally no separate backend service (see [ADR 0001](./docs/adr/0001-nextjs-serverless-monolith.md)).

```
Browser ──► Next.js (Vercel serverless)
              │  React Server Components  → direct data reads
              │  Server Actions           → validated mutations
              │  Route Handlers           → streaming (AI/SSE), presigned uploads, webhooks, cron
              │
              ├─► PostgreSQL (Neon)          via Prisma + driver adapters
              ├─► Upstash Redis (REST)       cache + rate limiting
              ├─► Cloudflare R2 (S3 API)     files via presigned URLs
              └─► AI Gateway ── Gemini / Groq / AIAND (env-switched)
```

## Layering rules

1. **Data access is server-only.** Prisma is only reachable from Server Components, Server Actions and Route Handlers via `getDb()`. No database types leak to the client bundle.
2. **Reads**: Server Components fetch directly for first paint; interactive views (boards, infinite lists) use TanStack Query against thin route handlers.
3. **Writes**: Server Actions are the default mutation path — every action authenticates, validates its input with Zod, applies rate limits where abusable, and revalidates affected caches. Route handlers are reserved for what actions can't do: streaming responses (AI chat), presigned upload flows, webhooks and cron endpoints.
4. **Validation at every boundary** with Zod: environment (src/lib/env.ts), action/handler inputs (feature schemas), AI tool arguments.
5. **Typed errors** (`src/lib/errors.ts`) cross layers instead of strings; the transport boundary maps them to HTTP statuses / user messages.

## Folder structure

| Path             | Role                                                                                          | Populated |
| ---------------- | --------------------------------------------------------------------------------------------- | --------- |
| `src/app`        | Routes only — thin files that compose feature modules                                         | Phase 1   |
| `src/components` | Shared UI; `components/ui` is the shadcn/ui design system                                     | Phase 1   |
| `src/lib`        | Core infrastructure (env, db, redis, rate-limit, errors, utils)                               | Phase 1   |
| `src/services`   | External service abstractions (`ai`, `storage`)                                               | Phase 1   |
| `src/providers`  | React context providers (theme, query client)                                                 | Phase 1   |
| `src/features/*` | One folder per module: `components/`, `server/` (queries + actions), `schemas.ts`, `types.ts` | Phase 3+  |
| `src/hooks`      | Shared React hooks                                                                            | Phase 3+  |
| `src/store`      | Zustand stores (client-side UI state only — server data lives in Query)                       | Phase 3+  |
| `src/schemas`    | Cross-feature Zod schemas                                                                     | Phase 4+  |
| `src/types`      | Shared TypeScript types                                                                       | Phase 4+  |
| `src/actions`    | Cross-cutting server actions (feature actions live in their feature)                          | Phase 4+  |
| `src/utils`      | Pure utilities (dates, formatting)                                                            | Phase 3+  |

A feature module owns everything about its domain. Cross-feature access happens through a feature's `server/` exports — never by reaching into another feature's components.

## AI Gateway

`src/services/ai` isolates every vendor behind one interface ([ADR 0002](./docs/adr/0002-ai-gateway.md)):

- `AIProvider` — `complete()` and `stream()` over provider-agnostic messages, tools and results.
- Adapters: `GeminiProvider` (native REST), `GroqProvider` and `AIANDProvider` (both via a shared OpenAI-compatible base class).
- `getAIProvider()` selects the adapter from `AI_PROVIDER` — switching vendors is a config change.
- `completeWithRetry()` adds bounded exponential backoff for retryable failures (429/5xx/network).
- Tool calling is part of the contract from day one; the Global AI Chat phase composes module tools (tasks, calendar, finance, …) on top without touching adapters.

## Caching & rate limiting

- Upstash Redis over REST (serverless-safe). `cached()` provides read-through JSON caching under namespaced keys (`lifeos:<area>:<id>`); mutations invalidate explicitly.
- `createRateLimiter()` gives named sliding-window limiters (auth, api, ai). Without Redis it falls back to a per-instance in-memory window everywhere except strict production deployments, which fail fast.

## Storage

Cloudflare R2 via the S3 API. File bytes never transit the serverless functions: browsers upload and download through short-lived presigned URLs. Object keys are namespaced per user (`users/<id>/<category>/<uuid>-<name>`) so authorization is enforceable by prefix and account deletion is a prefix purge.

## Security baseline (Phase 1)

- Baseline security headers in `next.config.ts` (nosniff, frame deny, referrer policy, permissions policy); full CSP lands in the hardening phase.
- Secure-by-default session cookies and CSRF protection arrive with Auth.js in Phase 2; Server Actions additionally get Next's built-in origin checks.
- Secrets only via environment variables — validated at boot ([ADR 0004](./docs/adr/0004-environment-validation.md)), never committed.

## Authentication (Phase 2)

Auth.js v5 with JWT sessions ([ADR 0005](./docs/adr/0005-authjs-jwt-credentials.md)). Google/GitHub OAuth register only when configured; email+password uses Argon2id hashes with enumeration-safe, rate-limited sign-in. `src/middleware.ts` (edge) guards `/dashboard/**` from the shared adapter-free config; the Node instance adds the Prisma adapter through a lazy function config. Sessions expose `user.id`; everything else is read fresh from Postgres.

## App shell (Phase 3)

The authenticated shell lives in the (app) route group: an inset, icon-collapsible sidebar rendered from `src/components/app-shell/nav-config.ts` (the single source of truth for the module map — shipping a module flips its status there), a header with the current section, theme toggle and user menu, and a global ⌘K command palette (cmdk) whose open state is the first Zustand store. Route transitions use a `template.tsx` with Motion (fade-and-rise, reduced-motion aware). The dashboard is a widget grid over real data only — each module ships its own widgets alongside its phase.

## Environments

| Concern   | Development                            | Production (Vercel)                       |
| --------- | -------------------------------------- | ----------------------------------------- |
| Postgres  | Local/embedded (`pnpm db:local`)       | Neon via serverless driver                |
| Redis     | Optional (in-memory limiter)           | Required — auth rate limiting consumes it |
| R2        | Optional (typed not-configured errors) | Warned until Documents ship               |
| Env check | Warnings at boot                       | Strict — deploy fails on missing vars     |
