import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import ws from "ws";

import { getEnv, requireServerEnv } from "@/lib/env";
import { PrismaClient } from "@/generated/prisma";

/**
 * Data layer entry point.
 *
 * Prisma runs through driver adapters (see docs/adr/0003-prisma-neon.md):
 * - Neon serverless driver (HTTP/WebSocket) in production — no TCP sockets,
 *   which keeps the client compatible with serverless and restricted networks.
 * - node-postgres for local development against any regular Postgres.
 *
 * The client is created lazily on first use so that importing this module
 * never fails at build time on machines without a DATABASE_URL.
 */

function resolveDriver(connectionString: string): "neon" | "pg" {
  const forced = getEnv().DATABASE_DRIVER;
  if (forced) return forced;
  try {
    const host = new URL(connectionString).hostname;
    if (host.endsWith(".neon.tech")) return "neon";
  } catch {
    // Fall through to the default driver; Prisma will surface a clear
    // connection error if the string is genuinely malformed.
  }
  return "pg";
}

function createPrismaClient(): PrismaClient {
  const connectionString = requireServerEnv(
    "DATABASE_URL",
    "Point it at Neon (production) or a local Postgres (development).",
  );

  if (resolveDriver(connectionString) === "neon") {
    // The Neon driver needs a WebSocket implementation for pooled queries.
    // Node >= 22 ships one globally; fall back to the "ws" package otherwise.
    neonConfig.webSocketConstructor =
      typeof globalThis.WebSocket !== "undefined" ? globalThis.WebSocket : ws;
    return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

/**
 * Get the process-wide Prisma client. Cached on globalThis so hot reload in
 * development does not exhaust database connections.
 */
export function getDb(): PrismaClient {
  globalForPrisma.prismaClient ??= createPrismaClient();
  return globalForPrisma.prismaClient;
}
