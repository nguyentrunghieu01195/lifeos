# ADR 0006 — File storage: Cloudflare R2 behind a driver abstraction

## Status

Accepted (Phase 7).

## Context

The Documents module (and later avatars and note images) needs durable file
storage. The app runs serverless on Vercel, which imposes two hard limits:

- Function payloads are capped (~4.5 MB) and billed by duration — file bytes
  must not flow through the application server.
- The filesystem is ephemeral — anything written to disk disappears between
  invocations.

Development and CI have the opposite constraint: they must exercise the whole
upload/preview/delete flow without cloud credentials.

## Decision

**1. `StorageDriver` interface with two implementations** (`src/lib/storage/`):

- `r2` — Cloudflare R2 through its S3-compatible API, signed with
  [aws4fetch](https://github.com/mhart/aws4fetch) (~6 KB, pure fetch). The AWS
  SDK was rejected for cold-start weight; aws4fetch is Cloudflare's own
  recommendation for workers/serverless.
- `local` — files under `.storage/` (gitignored). Selected only when R2 is not
  configured **and** the deployment is not strict production, mirroring the
  in-memory rate limiter fallback. Strict production without R2 throws
  `NotConfiguredError` at the point of use, and boot validation warns.

**2. Direct-to-storage uploads.** A Server Action records a `PENDING` row and
returns an upload URL (presigned PUT on R2; `PUT /api/uploads/[id]` on local).
The browser sends the bytes straight to storage. A second action
(`finalizeUpload`) verifies the object's real size against the declared size
via HEAD, then flips the row to `READY`. Mismatches destroy both object and
row. Abandoned `PENDING` rows are swept after 24 h when the library loads.

**3. Stable authenticated file URLs.** `/api/files/[id]` checks the session
and ownership, then 302-redirects to a short-lived presigned GET (R2) or
streams from disk (local). Notes can embed `/api/files/[id]` in image nodes
without ever holding an expiring URL. Because presigned PUTs sign the host
only, objects land as `application/octet-stream`; the download URL overrides
`response-content-type`/`-disposition` from the database.

**4. Inline allowlist.** Only raster images and PDF are ever served inline.
SVG (scriptable on our origin) and everything else are forced to
`attachment` with `X-Content-Type-Options: nosniff`.

## Consequences

- Uploading from the browser to R2 requires a CORS policy on the bucket
  (documented in the README) — a one-time setup step per deployment.
- E2E tests cover the full byte-path in CI via the local driver; the R2
  driver's request shapes are unit-testable but its integration is verified
  manually against a real bucket.
- File size is capped at 25 MB and types are allowlisted; enforcement is
  declared-size at ticket time plus verified-size at finalize, since presigned
  PUT URLs cannot enforce a byte range server-side.
