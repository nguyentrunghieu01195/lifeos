#!/usr/bin/env node
/**
 * Boot a self-contained local Postgres for development and tests — no Docker,
 * no system install. Data persists in ./.pgdata (gitignored).
 *
 * Usage:
 *   pnpm db:local          # start (Ctrl+C to stop)
 *
 * Connection string (matches .env.example):
 *   postgresql://postgres:postgres@127.0.0.1:54322/lifeos
 *
 * Any regular Postgres works too — this script is a convenience, not a requirement.
 */
import { existsSync, readdirSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(new URL(import.meta.url)));
const PROJECT = join(ROOT, "..");
const DATA_DIR = join(PROJECT, ".pgdata");
const PORT = 54322;

/**
 * npm tarballs don't preserve symlinks, so the bundled Postgres binaries can't
 * find their shared libraries by soname (e.g. libpq.so.5 -> libpq.so.5.18).
 * Recreate the soname links and expose the lib dir via LD_LIBRARY_PATH.
 */
function prepareSharedLibraries() {
  const pnpmDir = join(PROJECT, "node_modules", ".pnpm");
  if (!existsSync(pnpmDir)) return;
  const binaryPkg = readdirSync(pnpmDir).find((name) =>
    name.startsWith("@embedded-postgres+linux-x64"),
  );
  if (!binaryPkg) return;

  const libDir = join(
    pnpmDir,
    binaryPkg,
    "node_modules",
    "@embedded-postgres",
    "linux-x64",
    "native",
    "lib",
  );
  if (!existsSync(libDir)) return;

  for (const file of readdirSync(libDir)) {
    // libfoo.so.5.18 -> ensure libfoo.so.5 and libfoo.so exist
    const match = /^(lib[^/]+\.so)((?:\.\d+)+)$/.exec(file);
    if (!match) continue;
    const [, base, versions] = match;
    const parts = versions.slice(1).split(".");
    const candidates = [base, `${base}.${parts[0]}`];
    for (const candidate of candidates) {
      const target = join(libDir, candidate);
      if (!existsSync(target)) {
        try {
          symlinkSync(file, target);
        } catch {
          // Best effort — another process may have created it concurrently.
        }
      }
    }
  }

  process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
    ? `${libDir}:${process.env.LD_LIBRARY_PATH}`
    : libDir;
}

prepareSharedLibraries();

const { default: EmbeddedPostgres } = await import("embedded-postgres");

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
});

if (!existsSync(join(DATA_DIR, "PG_VERSION"))) {
  console.log("[db:local] initializing new Postgres cluster in .pgdata ...");
  await pg.initialise();
}

await pg.start();

try {
  await pg.createDatabase("lifeos");
  console.log('[db:local] created database "lifeos"');
} catch {
  // Database already exists — fine.
}

console.log(`[db:local] ready — postgresql://postgres:postgres@127.0.0.1:${PORT}/lifeos`);
console.log("[db:local] press Ctrl+C to stop");

const stop = async () => {
  console.log("\n[db:local] stopping ...");
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
