import { getDataClient } from "@/lib/db";
import type { Crop, CropRecord } from "@/lib/db/types";

const MAX_ROWS = 100;

export async function listCropCatalogue(): Promise<Crop[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<Crop>("crops")
    .select("*")
    .eq("is_active", true)
    .order("name_en", { ascending: true })
    .limit(MAX_ROWS);
  if (error) return [];
  return (data ?? []) as Crop[];
}

export async function listCropRecords(userId: string): Promise<CropRecord[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<CropRecord>("crop_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    console.error("[crops] list failed:", error.message);
    return [];
  }
  return (data ?? []) as CropRecord[];
}

export async function getActiveCropRecords(userId: string): Promise<CropRecord[]> {
  const records = await listCropRecords(userId);
  return records.filter((record) => record.status === "sown" || record.status === "growing" || record.status === "planned");
}

export interface CropRecordInput {
  crop_name: string;
  crop_id?: string | null;
  farm_id?: string | null;
  season: CropRecord["season"];
  variety?: string | null;
  area_acres?: number | null;
  sowing_date?: string | null;
  expected_harvest_date?: string | null;
  status: CropRecord["status"];
  notes?: string | null;
}

export async function createCropRecord(
  userId: string,
  input: CropRecordInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<CropRecord>("crop_records")
    .insert({ ...input, user_id: userId })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateCropRecord(
  userId: string,
  recordId: string,
  input: Partial<CropRecordInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("crop_records").update(input).eq("id", recordId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteCropRecord(userId: string, recordId: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("crop_records").delete().eq("id", recordId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getCropRecord(userId: string, recordId: string): Promise<CropRecord | null> {
  const db = await getDataClient();
  const { data } = await db
    .from<CropRecord>("crop_records")
    .select("*")
    .eq("id", recordId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CropRecord) ?? null;
}
