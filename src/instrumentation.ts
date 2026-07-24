/**
 * Next.js instrumentation hook — runs once when a server instance boots.
 * Validates the environment contract early so misconfigured deployments fail
 * at startup with a readable report instead of failing per-request.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Skip during `next build`: pages are compiled without runtime secrets.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { assertBootEnvironment } = await import("@/lib/env");
  assertBootEnvironment();
}
