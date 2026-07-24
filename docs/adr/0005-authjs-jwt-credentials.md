# ADR 0005 — Auth.js v5, JWT sessions, credentials with Argon2id

**Status:** Accepted · **Phase:** 2

## Context

LifeOS needs Google OAuth, GitHub OAuth and email+password login on the App Router, serverless, with protected routes enforced before rendering.

## Decision

- **Auth.js v5 (`next-auth@5.0.0-beta`)** — pinned deliberately: it is the only App-Router-native line (route handlers, `auth()` in RSC, middleware integration). v4 predates the App Router model.
- **JWT session strategy**, not database sessions:
  1. required by the Credentials provider,
  2. middleware authorizes requests without a database roundtrip,
  3. serverless-friendly (no session-table hot path). The Prisma adapter still manages users/accounts for OAuth linking; the Session model exists for a future strategy switch.
- **Split config**: `src/lib/auth/config.ts` is edge-safe (no adapter, no Node deps) and feeds the middleware; `src/lib/auth/index.ts` extends it with the Prisma adapter and providers. The full config is a **function**, so env access and `getDb()` resolve per request — env-less builds never execute them (ADR 0004).
- **Passwords: Argon2id** via `@node-rs/argon2` (prebuilt N-API binaries; OWASP parameters: 19 MiB, t=2, p=1). Not bcrypt — weaker against GPU attacks and has a 72-byte input limit.
- **User-enumeration mitigations**: identical error message for unknown email vs wrong password; timing equalized by verifying against a dummy hash when the account doesn't exist; login and registration rate-limited (sliding windows per IP / IP+email).
- **OAuth providers register conditionally** — a provider appears only when both its env credentials exist, so the UI never renders a dead button.

## Self-hosting gotchas (discovered by live verification, kept for posterity)

Both settings live in the **shared** config so the middleware instance gets them too:

1. `secret: process.env.AUTH_SECRET` as a **static** reference — the edge/middleware bundle only exposes statically referenced env vars; relying on Auth.js' internal dynamic lookup breaks JWT decoding under `next start`.
2. `trustHost: true` — without it the middleware instance rejects the Host header when self-hosted and every session read returns null (visible as an endless redirect to /login while `/api/auth/session` works).

## Consequences

- Middleware guards `/dashboard/**` and bounces authenticated users away from `/login`/`/register`; pages still call `auth()` as defense in depth.
- Session payload carries only `user.id` (+ default name/email/image); anything else is fetched fresh from the database per request.
- Email verification and magic links can be added later via the already-present VerificationToken model without schema changes.
