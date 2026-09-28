import { getDataClient } from "@/lib/db";
import type { Language, Profile, PublicProfile, UserRole } from "@/lib/db/types";

export async function getProfile(userId: string): Promise<Profile | null> {
  const db = await getDataClient();
  const { data } = await db.from<Profile>("profiles").select("*").eq("id", userId).maybeSingle();
  return (data as Profile) ?? null;
}

export async function getPublicProfile(userId: string): Promise<PublicProfile | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<PublicProfile>("public_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  return (data as PublicProfile) ?? null;
}

export interface ProfileInput {
  full_name?: string;
  phone?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  preferred_language?: Language;
  bio?: string | null;
  avatar_url?: string | null;
  simple_mode?: boolean;
  role?: UserRole;
}

export async function updateProfile(
  userId: string,
  input: ProfileInput,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("profiles").update({ ...input } as Record<string, unknown>).eq("id", userId);
  if (error) {
    // The database trigger blocks role/blocked-status changes by non-admins.
    if (/administrators/i.test(error.message)) {
      return { ok: false, error: "Only administrators can change a role." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

export async function updateAvatar(userId: string, avatarUrl: string | null): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("profiles").update({ avatar_url: avatarUrl }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
