import { getDataClient } from "@/lib/db";
import type { SoilRecord } from "@/lib/db/types";

const MAX_ROWS = 100;

export async function listSoilRecords(userId: string): Promise<SoilRecord[]> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<SoilRecord>("soil_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (error) {
    console.error("[soil] list failed:", error.message);
    return [];
  }
  return (data ?? []) as SoilRecord[];
}

export async function getLatestSoilRecord(userId: string): Promise<SoilRecord | null> {
  const records = await listSoilRecords(userId);
  return records[0] ?? null;
}

export interface SoilInput {
  soil_type?: string | null;
  farm_id?: string | null;
  ph?: number | null;
  nitrogen?: number | null;
  phosphorus?: number | null;
  potassium?: number | null;
  moisture_pct?: number | null;
  organic_matter_pct?: number | null;
  electrical_conductivity?: number | null;
  source: SoilRecord["source"];
  dataset_name?: string | null;
  dataset_reference?: string | null;
  measured_at?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export async function createSoilRecord(
  userId: string,
  input: SoilInput,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = await getDataClient();
  const { data, error } = await db
    .from<SoilRecord>("soil_records")
    .insert({ ...input, user_id: userId })
    .select("id")
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function updateSoilRecord(
  userId: string,
  recordId: string,
  input: Partial<SoilInput>,
): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("soil_records").update(input).eq("id", recordId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteSoilRecord(userId: string, recordId: string): Promise<{ ok: boolean; error?: string }> {
  const db = await getDataClient();
  const { error } = await db.from("soil_records").delete().eq("id", recordId).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Interprets soil values WITHOUT inventing them.
 * Ranges are standard agronomic reference bands (ICAR-style), used only to label
 * the farmer's own numbers as low / optimal / high.
 */
export interface SoilReading {
  key: "ph" | "nitrogen" | "phosphorus" | "potassium" | "organic_matter_pct";
  label: string;
  value: number | null;
  unit: string;
  rating: "low" | "optimal" | "high" | "unknown";
  referenceBand: string;
}

export function interpretSoil(record: SoilRecord | null): SoilReading[] {
  const number = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const bands: Array<{
    key: SoilReading["key"];
    unit: string;
    band: string;
    low: number;
    high: number;
    label: string;
  }> = [
    { key: "ph", unit: "", band: "6.0 – 7.5 (most crops)", low: 6.0, high: 7.5, label: "pH" },
    { key: "nitrogen", unit: "kg/ha", band: "280 – 560 kg/ha (available N)", low: 280, high: 560, label: "Nitrogen (N)" },
    { key: "phosphorus", unit: "kg/ha", band: "10 – 25 kg/ha (available P)", low: 10, high: 25, label: "Phosphorus (P)" },
    { key: "potassium", unit: "kg/ha", band: "110 – 280 kg/ha (available K)", low: 110, high: 280, label: "Potassium (K)" },
    { key: "organic_matter_pct", unit: "%", band: "0.5 – 1.0 % (Indian soils)", low: 0.5, high: 1.0, label: "Organic matter" },
  ];

  return bands.map((entry) => {
    const value = number(record?.[entry.key]);
    let rating: SoilReading["rating"] = "unknown";
    if (value !== null) {
      rating = value < entry.low ? "low" : value > entry.high ? "high" : "optimal";
    }
    return {
      key: entry.key,
      label: entry.label,
      value,
      unit: entry.unit,
      rating,
      referenceBand: entry.band,
    };
  });
}
