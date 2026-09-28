/** Upload validation shared by image uploads (crop photos, listings, avatars). */

export const BUCKET_LIMITS = {
  avatars: 2 * 1024 * 1024,
  "listing-images": 5 * 1024 * 1024,
  "crop-images": 10 * 1024 * 1024,
} as const;

export type StorageBucket = keyof typeof BUCKET_LIMITS;

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface ValidatedImage {
  ok: true;
  mimeType: string;
  extension: string;
  size: number;
  bytes: Uint8Array;
}
export interface InvalidImage {
  ok: false;
  error: string;
}

/** Sniffs real file signatures so a renamed file cannot masquerade as an image. */
function detectImageType(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
  const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function validateImageFile(
  file: File,
  bucket: StorageBucket,
): Promise<ValidatedImage | InvalidImage> {
  const limit = BUCKET_LIMITS[bucket];

  if (!file || typeof file.arrayBuffer !== "function" || file.size === 0) {
    return { ok: false, error: "Please choose an image file." };
  }
  if (file.size > limit) {
    const mb = (limit / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `That image is too large. Maximum size is ${mb} MB.` };
  }
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Only JPEG, PNG or WebP images are accepted." };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImageType(buffer);
  if (!detected) {
    return { ok: false, error: "That file does not look like a valid JPEG, PNG or WebP image." };
  }
  if (file.type && detected !== file.type) {
    return { ok: false, error: "The file contents do not match its declared image type." };
  }

  return {
    ok: true,
    mimeType: detected,
    extension: EXTENSIONS[detected] ?? "jpg",
    size: buffer.byteLength,
    bytes: buffer,
  };
}

/** Builds a storage path inside the owner's folder (mirrors the storage RLS rule). */
export function buildStoragePath(userId: string, fileName: string, extension: string): string {
  const safeName = fileName
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
  const unique = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `${userId}/${safeName}-${unique}.${extension}`;
}
