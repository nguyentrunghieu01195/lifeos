import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { getEnv } from "@/lib/env";
import { NotConfiguredError } from "@/lib/errors";

/**
 * Cloudflare R2 storage service (S3-compatible API).
 *
 * Uploads and downloads flow through short-lived presigned URLs so file bytes
 * never transit the serverless functions. The client is created lazily and the
 * service throws a typed NotConfiguredError until R2 credentials are set.
 */

interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl?: string;
}

function readConfig(): R2Config {
  const env = getEnv();
  if (
    !env.R2_ACCOUNT_ID ||
    !env.R2_ACCESS_KEY_ID ||
    !env.R2_SECRET_ACCESS_KEY ||
    !env.R2_BUCKET_NAME
  ) {
    throw new NotConfiguredError(
      "Cloudflare R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME.",
    );
  }
  return {
    accountId: env.R2_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET_NAME,
    ...(env.R2_PUBLIC_BASE_URL ? { publicBaseUrl: env.R2_PUBLIC_BASE_URL } : {}),
  };
}

export function isStorageConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME,
  );
}

let cachedClient: { client: S3Client; config: R2Config } | null = null;

function getClient(): { client: S3Client; config: R2Config } {
  if (!cachedClient) {
    const config = readConfig();
    cachedClient = {
      config,
      client: new S3Client({
        region: "auto",
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      }),
    };
  }
  return cachedClient;
}

export interface PresignedUploadInput {
  key: string;
  contentType: string;
  /** Seconds the URL stays valid. Default 600 (10 minutes). */
  expiresInSeconds?: number;
}

/** Presigned PUT URL for direct browser uploads. */
export async function createPresignedUploadUrl({
  key,
  contentType,
  expiresInSeconds = 600,
}: PresignedUploadInput): Promise<string> {
  const { client, config } = getClient();
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export interface PresignedDownloadInput {
  key: string;
  /** Seconds the URL stays valid. Default 300 (5 minutes). */
  expiresInSeconds?: number;
  /** When set, forces a download with this filename. */
  downloadFilename?: string;
}

/** Presigned GET URL for direct browser downloads/previews. */
export async function createPresignedDownloadUrl({
  key,
  expiresInSeconds = 300,
  downloadFilename,
}: PresignedDownloadInput): Promise<string> {
  const { client, config } = getClient();
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ...(downloadFilename
      ? {
          ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadFilename)}`,
        }
      : {}),
  });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

/** Server-side upload for small internally generated objects (e.g. exports). */
export async function uploadObject(input: {
  key: string;
  body: Uint8Array | string;
  contentType: string;
}): Promise<void> {
  const { client, config } = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
    }),
  );
}

/** Confirm an object exists (used to verify completed browser uploads) and read its size. */
export async function headObject(
  key: string,
): Promise<{ exists: boolean; size?: number; contentType?: string }> {
  const { client, config } = getClient();
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    return {
      exists: true,
      ...(result.ContentLength !== undefined ? { size: result.ContentLength } : {}),
      ...(result.ContentType !== undefined ? { contentType: result.ContentType } : {}),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "NotFound" || error.name === "NoSuchKey" || error.name === "404")
    ) {
      return { exists: false };
    }
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, config } = getClient();
  await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
}

/** Public URL for objects in buckets exposed via R2_PUBLIC_BASE_URL. */
export function getPublicUrl(key: string): string | null {
  const env = getEnv();
  if (!env.R2_PUBLIC_BASE_URL) return null;
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;
}
