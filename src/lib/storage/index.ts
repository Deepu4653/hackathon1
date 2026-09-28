/**
 * Storage service.
 *
 * Supabase Storage in production, an equivalent on-disk store locally — both
 * behind the same API, with the same validation, the same `<user-id>/…` folder
 * ownership rule and the same access checks.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { dataBackend, publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StorageBucket } from "./validate";

export type { StorageBucket } from "./validate";
export { BUCKET_LIMITS, buildStoragePath, validateImageFile } from "./validate";

export const PUBLIC_BUCKETS: StorageBucket[] = ["avatars", "listing-images"];

export function isPublicBucket(bucket: string): boolean {
  return PUBLIC_BUCKETS.includes(bucket as StorageBucket);
}

function localRoot(): string {
  return path.resolve(process.cwd(), ".data/uploads");
}

function localStoragePath(bucket: string, objectPath: string): string {
  const normalised = path
    .normalize(objectPath)
    .replace(/^([./\\])+/, "")
    .replace(/\\/g, "/");
  if (normalised.includes("..")) {
    throw new Error("Invalid storage path.");
  }
  return path.join(localRoot(), bucket, normalised);
}

export interface UploadedObject {
  bucket: StorageBucket;
  path: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface UploadError {
  error: string;
}

/** Uploads validated bytes to the configured store. */
export async function uploadObject(params: {
  bucket: StorageBucket;
  objectPath: string;
  bytes: Uint8Array;
  mimeType: string;
  fileName: string;
  upsert?: boolean;
}): Promise<UploadedObject | UploadError> {
  const { bucket, objectPath, bytes, mimeType, upsert = false } = params;

  try {
    if (dataBackend() === "supabase") {
      const admin = getSupabaseAdminClient();
      const client = admin ?? (await createSupabaseServerClient());
      const { error } = await client.storage.from(bucket).upload(objectPath, bytes, {
        contentType: mimeType,
        upsert,
        cacheControl: "3600",
      });
      if (error) return { error: `Upload failed: ${error.message}` };
      return {
        bucket,
        path: objectPath,
        url: objectUrl(bucket, objectPath),
        size: bytes.byteLength,
        mimeType,
      };
    }

    const target = localStoragePath(bucket, objectPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes);
    return {
      bucket,
      path: objectPath,
      url: objectUrl(bucket, objectPath),
      size: bytes.byteLength,
      mimeType,
    };
  } catch (error) {
    console.error("[storage] upload failed", error);
    return { error: "We could not store that image right now. Please try again." };
  }
}

export async function removeObject(bucket: StorageBucket, objectPath: string): Promise<void> {
  try {
    if (dataBackend() === "supabase") {
      const admin = getSupabaseAdminClient() ?? (await createSupabaseServerClient());
      await admin.storage.from(bucket).remove([objectPath]);
      return;
    }
    await fs.rm(localStoragePath(bucket, objectPath), { force: true });
  } catch (error) {
    console.warn("[storage] remove failed", error);
  }
}

/**
 * URL the browser should use.
 * Public buckets → CDN URL (Supabase) or the app's own file route (local).
 * Private buckets → always the app route, which re-checks ownership server-side.
 */
export function objectUrl(bucket: string, objectPath: string): string {
  if (isPublicBucket(bucket) && dataBackend() === "supabase") {
    return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${objectPath}`;
  }
  return `/api/storage/${bucket}/${objectPath}`;
}

/** Short-lived signed URL for a private object (Supabase) — used by the proxy route. */
export async function createSignedUrl(
  bucket: StorageBucket,
  objectPath: string,
  expiresInSeconds = 60,
): Promise<string | null> {
  if (dataBackend() !== "supabase") return null;
  const admin = getSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(objectPath, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Reads bytes for a private object (local driver). */
export async function readLocalObject(
  bucket: string,
  objectPath: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  try {
    const filePath = localStoragePath(bucket, objectPath);
    const bytes = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mimeType =
      ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream";
    return { bytes, mimeType };
  } catch {
    return null;
  }
}

export const storageDriver = serverEnv.storageDriver;
