import "server-only";

import { getEnv, isStrictProduction } from "@/lib/env";
import { NotConfiguredError } from "@/lib/errors";

import { createLocalDriver } from "./local";
import { createR2Driver } from "./r2";

/**
 * File storage abstraction (see docs/adr/0006-file-storage.md).
 *
 * Two drivers implement the same contract:
 * - "r2": Cloudflare R2 through presigned URLs (aws4fetch SigV4). The browser
 *   talks to R2 directly, so file bytes never flow through a serverless
 *   function.
 * - "local": files on disk under .storage/ — development and CI only, so the
 *   whole upload/preview/delete flow stays end-to-end testable without cloud
 *   credentials. Mirrors the in-memory rate limiter fallback: never active on
 *   strict production deployments.
 */

export type StorageKind = "r2" | "local";

export interface StorageDriver {
  kind: StorageKind;
  /**
   * URL the browser PUTs the file bytes to. R2 returns a presigned URL;
   * local returns the app's own upload endpoint for this document.
   */
  createUploadUrl(input: { key: string; documentId: string }): Promise<string>;
  /** Size of the stored object in bytes, or null when it does not exist. */
  statSize(key: string): Promise<number | null>;
  /**
   * Browser-facing download/preview URL. R2 returns a short-lived presigned
   * GET (with content-type/disposition overrides); local returns null — the
   * file route streams bytes from disk instead.
   */
  createDownloadUrl(input: {
    key: string;
    filename: string;
    contentType: string;
    inline: boolean;
  }): Promise<string | null>;
  remove(key: string): Promise<void>;
}

let driver: StorageDriver | null = null;
let warnedLocal = false;

export function getStorage(): StorageDriver {
  if (driver) return driver;

  const env = getEnv();
  const configured =
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME;

  if (configured) {
    driver = createR2Driver({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET_NAME!,
    });
    return driver;
  }

  if (isStrictProduction()) {
    // Real deployments must not silently write to an ephemeral filesystem.
    throw new NotConfiguredError(
      "File storage needs Cloudflare R2 — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.",
    );
  }

  if (!warnedLocal) {
    warnedLocal = true;
    console.warn(
      "[storage] R2 not configured — storing files on the local filesystem (.storage/). Do not ship real traffic like this.",
    );
  }
  driver = createLocalDriver();
  return driver;
}

/** Test helper — forces the next getStorage() call to re-resolve the driver. */
export function resetStorageDriver(): void {
  driver = null;
}
