import { cookies } from "next/headers";
import { getPrimaryFarm } from "@/lib/repos/farms";
import type { Farm } from "@/lib/db/types";

export interface ResolvedLocation {
  latitude: number;
  longitude: number;
  label: string | null;
  source: "cookie" | "farm" | "none";
  farm: Farm | null;
}

export const LOCATION_COOKIES = {
  lat: "xfarm-lat",
  lon: "xfarm-lon",
  place: "xfarm-place",
} as const;

/**
 * Resolves "which field are we showing weather for?".
 *
 * Priority: the location the user explicitly picked (cookie) → their primary
 * farm → nothing. A brand-new visitor is never shown a hard-coded default; the
 * UI asks them to choose instead.
 */
export async function resolveWeatherLocation(userId: string | null): Promise<ResolvedLocation> {
  const cookieStore = await cookies();
  const lat = Number.parseFloat(cookieStore.get(LOCATION_COOKIES.lat)?.value ?? "");
  const lon = Number.parseFloat(cookieStore.get(LOCATION_COOKIES.lon)?.value ?? "");
  const label = cookieStore.get(LOCATION_COOKIES.place)?.value
    ? decodeURIComponent(cookieStore.get(LOCATION_COOKIES.place)!.value)
    : null;

  let farm: Farm | null = null;
  if (userId) {
    farm = await getPrimaryFarm(userId);
  }

  // The cookie is written by the browser, so it is validated like any input:
  // out-of-range values are ignored rather than forwarded to Open-Meteo.
  if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
    return { latitude: lat, longitude: lon, label, source: "cookie", farm };
  }

  if (
    farm?.latitude != null &&
    farm?.longitude != null &&
    Math.abs(farm.latitude) <= 90 &&
    Math.abs(farm.longitude) <= 180
  ) {
    return {
      latitude: farm.latitude,
      longitude: farm.longitude,
      label: farm.name,
      source: "farm",
      farm,
    };
  }

  return { latitude: Number.NaN, longitude: Number.NaN, label: null, source: "none", farm };
}
