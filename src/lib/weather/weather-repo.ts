import { getDataClient } from "@/lib/db";
import type { WeatherRecord } from "@/lib/db/types";
import type { WeatherSnapshot } from "./open-meteo";

/** Persists a fetched snapshot so the dashboard can show the last known values. */
export async function saveWeatherSnapshot(input: {
  userId: string;
  farmId: string | null;
  snapshot: WeatherSnapshot;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const db = await getDataClient();
    const { error } = await db.from("weather_records").insert({
      user_id: input.userId,
      farm_id: input.farmId,
      latitude: input.snapshot.latitude,
      longitude: input.snapshot.longitude,
      observed_at: input.snapshot.observedAt,
      temperature_c: input.snapshot.current.temperatureC,
      humidity_pct: input.snapshot.current.humidityPct,
      wind_kph: input.snapshot.current.windKph,
      wind_direction_deg: input.snapshot.current.windDirectionDeg,
      rain_probability_pct: input.snapshot.current.rainProbabilityPct,
      precipitation_mm: input.snapshot.current.precipitationMm,
      condition_code: String(input.snapshot.current.conditionCode),
      condition_text: input.snapshot.current.conditionText,
      source: input.snapshot.source,
      alerts: input.snapshot.alerts,
    });
    if (error) return { ok: false, error: "We could not save that weather snapshot." };
    return { ok: true };
  } catch {
    return { ok: false, error: "We could not save that weather snapshot." };
  }
}

const LIMIT = 100;

/** Most recent stored snapshot for a farm (used when Open-Meteo is unreachable). */
export async function getLatestStoredWeather(
  farmId: string | null,
): Promise<WeatherRecord | null> {
  try {
    const db = await getDataClient();
    const query = db.from<WeatherRecord>("weather_records").select("*");
    const { data } = await (farmId ? query.eq("farm_id", farmId) : query)
      .order("observed_at", { ascending: false })
      .limit(LIMIT);
    const rows = (data ?? []) as WeatherRecord[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listStoredWeather(farmId: string | null, limit = 30): Promise<WeatherRecord[]> {
  try {
    const db = await getDataClient();
    const query = db.from<WeatherRecord>("weather_records").select("*");
    const scoped = farmId ? query.eq("farm_id", farmId) : query;
    const { data } = await scoped.order("observed_at", { ascending: false }).limit(Math.min(limit, 100));
    return (data ?? []) as WeatherRecord[];
  } catch {
    return [];
  }
}
