import { getDataClient } from "@/lib/db";
import type { Farm } from "@/lib/db/types";

const MAX_ROWS = 100;

export async function listFarms(userId: string): Promise<Farm[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Farm>("farms")
    .select("*")
    .eq("user_id", userId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    console.error("[farms] list failed:", error.message);
    return [];
  }
  return (data ?? []) as Farm[];
}

export async function getFarm(userId: string, farmId: string): Promise<Farm | null> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Farm>("farms")
    .select("*")
    .eq("id", farmId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return null;
  return (data as Farm) ?? null;
}

/** The farm used for dashboards and AI context: explicitly primary, else newest. */
export async function getPrimaryFarm(userId: string): Promise<Farm | null> {
  const farms = await listFarms(userId);
  return farms.find((farm) => farm.is_primary) ?? farms[0] ?? null;
}

export interface FarmInput {
  name: string;
  size_acres?: number | null;
  soil_type?: string | null;
  irrigation_source?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_primary?: boolean;
  notes?: string | null;
}

export async function createFarm(userId: string, input: FarmInput): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = await getDataClient();

  // Only one primary farm per user — enforced by a partial unique index, so the
  // previous primary must be cleared first.
  if (input.is_primary) {
    await db.from("farms").update({ is_primary: false }).eq("user_id", userId).eq("is_primary", true);
  }

  const { data, error } = await db
    .from<Farm>("farms")
    .insert({ ...input, user_id: userId })
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateFarm(
  userId: string,
  farmId: string,
  input: Partial<FarmInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();

  if (input.is_primary) {
    await db.from("farms").update({ is_primary: false }).eq("user_id", userId).eq("is_primary", true);
  }

  const { error } = await db.from("farms").update(input).eq("id", farmId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteFarm(userId: string, farmId: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("farms").delete().eq("id", farmId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
