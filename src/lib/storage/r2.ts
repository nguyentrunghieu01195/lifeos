import "server-only";

import { AwsClient } from "aws4fetch";

import { AppError } from "@/lib/errors";

import type { StorageDriver } from "./index";

/**
 * Cloudflare R2 driver.
 *
 * R2 speaks the S3 API; aws4fetch does SigV4 signing over plain fetch (~6KB,
 * no SDK cold-start cost — Cloudflare's own recommendation for serverless).
 * Uploads and downloads use query-signed URLs so the browser exchanges bytes
 * with R2 directly.
 *
 * PUT URLs sign the host only (no content-type header), so objects land as
 * application/octet-stream; download URLs override content-type and
 * disposition from our database via response-* query params.
 */

const UPLOAD_URL_TTL_SECONDS = 600;
const DOWNLOAD_URL_TTL_SECONDS = 300;

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

/** Encode each path segment, keeping the / separators. */
function encodeKey(key: string): string {
  return key.split("/").map(encodeURIComponent).join("/");
}

/** RFC 6266 disposition with a UTF-8 filename and an ASCII fallback. */
export function contentDisposition(filename: string, inline: boolean): string {
  const ascii = filename.replace(/[^ -~]/g, "_").replaceAll('"', "'");
  const encoded = encodeURIComponent(filename);
  return `${inline ? "inline" : "attachment"}; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export function createR2Driver(config: R2Config): StorageDriver {
  const client = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    service: "s3",
    region: "auto",
  });
  const baseUrl = `https://${config.accountId}.r2.cloudflarestorage.com/${config.bucket}`;

  const objectUrl = (key: string) => `${baseUrl}/${encodeKey(key)}`;

  return {
    kind: "r2",

    async createUploadUrl({ key }) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(UPLOAD_URL_TTL_SECONDS));
      const signed = await client.sign(new Request(url, { method: "PUT" }), {
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async statSize(key) {
      const response = await client.fetch(objectUrl(key), { method: "HEAD" });
      if (response.status === 404) return null;
      if (!response.ok) {
        throw new AppError(`Storage HEAD failed with status ${response.status}.`, {
          code: "INTERNAL",
          status: 502,
        });
      }
      const length = response.headers.get("content-length");
      return length === null ? null : Number(length);
    },

    async createDownloadUrl({ key, filename, contentType, inline }) {
      const url = new URL(objectUrl(key));
      url.searchParams.set("X-Amz-Expires", String(DOWNLOAD_URL_TTL_SECONDS));
      url.searchParams.set("response-content-type", contentType);
      url.searchParams.set("response-content-disposition", contentDisposition(filename, inline));
      const signed = await client.sign(new Request(url, { method: "GET" }), {
        aws: { signQuery: true },
      });
      return signed.url;
    },

    async remove(key) {
      const response = await client.fetch(objectUrl(key), { method: "DELETE" });
      if (!response.ok && response.status !== 404) {
        throw new AppError(`Storage DELETE failed with status ${response.status}.`, {
          code: "INTERNAL",
          status: 502,
        });
      }
    },
  };
}
