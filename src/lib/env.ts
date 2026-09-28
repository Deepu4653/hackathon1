/**
 * Client-safe environment configuration.
 *
 * Only `NEXT_PUBLIC_*` values are readable here, because this module is
 * imported by browser code. Server-only secrets live in `env.server.ts`.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN?.trim() ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000").replace(/\/$/, ""),
  supabaseStorageBucketCrops:
    process.env.NEXT_PUBLIC_SUPABASE_CROP_BUCKET?.trim() || "crop-images",
  supabaseStorageBucketListings:
    process.env.NEXT_PUBLIC_SUPABASE_LISTING_BUCKET?.trim() || "listing-images",
  supabaseStorageBucketAvatars:
    process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET?.trim() || "avatars",
} as const;

const truthy = (value: string | undefined) => /^(1|true|yes|on)$/i.test((value ?? "").trim());

/** Supabase is "configured" only when URL + anon key are both present. */
export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

/** Mapbox is optional: the map falls back to OpenStreetMap tiles when absent. */
export function isMapboxConfigured(): boolean {
  return Boolean(publicEnv.mapboxToken) && !truthy(process.env.NEXT_PUBLIC_DISABLE_MAPBOX);
}

export type DataBackend = "supabase" | "local";

/**
 * Which persistence backend this deployment uses.
 * `DATA_BACKEND` can force a choice; otherwise Supabase wins when configured.
 */
export function dataBackend(): DataBackend {
  const forced = (process.env.DATA_BACKEND || "").trim().toLowerCase();
  if (forced === "supabase") return "supabase";
  if (forced === "local") return "local";
  return isSupabaseConfigured() ? "supabase" : "local";
}

export function isLocalBackend(): boolean {
  return dataBackend() === "local";
}
