# LifeOS

**One home for your whole life.** LifeOS is a personal operating system powered by AI — tasks, calendar, notes, documents, finance, habits, health, shopping and a grounded AI assistant, together in one application.

## Stack

| Layer      | Technology                                                   |
| ---------- | ------------------------------------------------------------ |
| Framework  | Next.js 15 (App Router, Server Components, Server Actions)   |
| UI         | React 19 · TypeScript (strict) · Tailwind CSS v4 · shadcn/ui |
| Animation  | Motion (Framer Motion)                                       |
| Data       | PostgreSQL (Neon) · Prisma ORM with driver adapters          |
| Cache      | Upstash Redis (REST)                                         |
| Storage    | Cloudflare R2 (S3-compatible, presigned URLs)                |
| AI         | Provider-agnostic AI Gateway — Gemini · Groq · AIAND         |
| State      | TanStack Query · Zustand                                     |
| Forms      | React Hook Form · Zod                                        |
| Testing    | Vitest · React Testing Library · Playwright                  |
| Deployment | Vercel (serverless, no Docker)                               |

Architecture details live in [ARCHITECTURE.md](./ARCHITECTURE.md) and the decision records in [docs/adr](./docs/adr).

## Getting started

Prerequisites: **Node.js ≥ 20.9** and **pnpm** (`corepack enable`).

```bash
pnpm install
cp .env.example .env
```

### Database

Any PostgreSQL works. Pick one:

- **Zero-install local database** (no Docker, data in `.pgdata/`):

  ```bash
  pnpm db:local          # starts Postgres on 127.0.0.1:54322 — keep it running
  ```

  The default `DATABASE_URL` in `.env.example` already points at it.

- **Your own Postgres** — set `DATABASE_URL` accordingly.
- **Neon** — create a project at [neon.tech](https://neon.tech) and use its connection string.

Then apply migrations and start the app:

```bash
pnpm db:migrate        # prisma migrate dev
pnpm dev               # http://localhost:3000
```

The app boots without Redis/R2/AI keys in development (features that need them raise a clear "not configured" message). Fill `.env` progressively as you enable features.

### Authentication

Set `AUTH_SECRET` (generate: `openssl rand -base64 32`). Google/GitHub sign-in buttons appear automatically once the matching `*_CLIENT_ID`/`*_CLIENT_SECRET` pairs are set — callback URLs are documented in [.env.example](./.env.example). Email/password works with no extra configuration.

### Choosing the AI provider

```bash
AI_PROVIDER=gemini     # gemini | groq | aiand
```

Set the matching key (`GEMINI_API_KEY` / `GROQ_API_KEY` / `AIAND_API_KEY` + `AIAND_BASE_URL` + `AI_MODEL`). Switching providers is configuration only — no code changes.

## Scripts

| Script                  | Purpose                                      |
| ----------------------- | -------------------------------------------- |
| `pnpm dev`              | Dev server (Turbopack)                       |
| `pnpm build`            | Production build (runs `prisma generate`)    |
| `pnpm start`            | Serve the production build                   |
| `pnpm lint`             | ESLint                                       |
| `pnpm typecheck`        | TypeScript, no emit                          |
| `pnpm test`             | Unit/component tests (Vitest)                |
| `pnpm e2e`              | End-to-end tests (Playwright)                |
| `pnpm test:integration` | Unit + DB integration tests (needs Postgres) |
| `pnpm check`            | lint + typecheck + test                      |
| `pnpm db:migrate`       | Create/apply dev migrations                  |
| `pnpm db:deploy`        | Apply migrations in production               |
| `pnpm db:studio`        | Prisma Studio                                |
| `pnpm db:local`         | Boot the embedded local Postgres             |

## Deployment (Vercel)

1. **Neon** — create a database, copy the pooled connection string.
2. **Upstash** — create a Redis database, copy the REST URL + token.
3. **Cloudflare R2** — create a bucket and an API token (Object Read & Write).
4. **Vercel** — import the repo. No build settings needed: the `vercel-build` script applies pending migrations automatically before every build.
5. Set the environment variables from [.env.example](./.env.example) in Vercel → Project → Settings → Environment Variables.
6. Migrations run automatically during the Vercel build (`vercel-build`); to run them manually instead: `DATABASE_URL=<neon-url> pnpm db:deploy`.

Boot-time environment validation is strict on Vercel production deployments — a misconfigured deploy fails at startup with a readable report naming each missing variable.

## Project structure

```
src/
  app/           Routes (App Router) — route groups per surface, api/ handlers
  components/    Shared UI (shadcn/ui primitives in components/ui)
  features/      Feature modules (tasks, calendar, notes, …) — components, server logic, schemas
  providers/     React context providers (theme, query client)
  lib/           Core infrastructure: env, db, redis, rate-limit, errors, utils
  services/      External service abstractions: ai (gateway + providers), storage (R2)
  hooks/         Shared React hooks
  store/         Zustand stores
  schemas/       Cross-feature Zod schemas
  types/         Shared TypeScript types
prisma/          Schema + migrations
e2e/             Playwright tests
docs/adr/        Architecture decision records
```

## Roadmap

Delivered phase by phase; every phase compiles, passes tests, and ships migrations.

- [x] **Phase 1 — Architecture**: app scaffold, design system, env validation, data layer, Redis, R2, AI Gateway
- [x] **Phase 2 — Authentication**: Auth.js v5 — Google + GitHub OAuth, email/password (Argon2id), protected routes
- [x] **Phase 3 — App shell & Dashboard**: sidebar module map, ⌘K palette, theme toggle, motion, widget grid
- [x] **Phase 4 — Tasks**: list/board/calendar, subtasks, recurring, tags & projects, AI planning
- [ ] Phase 5 — Calendar · Phase 6 — Notes · Phase 7 — Documents
- [ ] Phase 8 — Finance · Phase 9 — Habits · Phase 10 — Health · Phase 11 — Shopping
- [ ] Phase 12 — Knowledge & Bookmarks · Phase 13 — Global AI Chat · Phase 14 — Search
- [ ] Phase 15 — Notifications · Phase 16 — Settings & Profile · Phase 17 — Hardening & Launch
