/**
 * Map + geocoding service.
 *
 * Mapbox is used when NEXT_PUBLIC_MAPBOX_TOKEN is configured. Without it the app
 * still works: search falls back to OpenStreetMap (Nominatim) and the map itself
 * renders OpenStreetMap raster tiles instead of Mapbox — so there is never a
 * dead "Map service unavailable" screen when a token is simply absent.
 */

import { isMapboxConfigured, publicEnv } from "@/lib/env";

export interface Place {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
  source: "mapbox" | "openstreetmap";
}

export type GeocodeOutcome =
  | { ok: true; places: Place[] }
  | { ok: false; reason: "unavailable" | "empty_query"; message: string };

const TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, headers: Record<string, string> = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal, headers, cache: "no-store" });
  } finally {
    clearTimeout(timer);
  }
}

async function mapboxSearch(query: string, proximity?: [number, number]): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "6",
    language: "en",
    country: "in",
    access_token: publicEnv.mapboxToken,
  });
  if (proximity) params.set("proximity", `${proximity[0]},${proximity[1]}`);

  const response = await fetchWithTimeout(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
  );
  if (!response.ok) throw new Error(`mapbox ${response.status}`);

  const payload = (await response.json()) as {
    features?: Array<{
      id?: string;
      properties?: { name?: string; full_address?: string; place_formatted?: string; coordinates?: { latitude: number; longitude: number } };
      geometry?: { coordinates?: [number, number] };
      place_name?: string;
    }>;
  };

  return (payload.features ?? []).map((feature, index) => {
    const coords =
      feature.geometry?.coordinates ??
      (feature.properties?.coordinates
        ? [feature.properties.coordinates.longitude, feature.properties.coordinates.latitude]
        : undefined);
    return {
      id: feature.id ?? `mapbox-${index}`,
      name: feature.properties?.name ?? feature.place_name ?? "Location",
      fullName:
        feature.properties?.full_address ??
        feature.properties?.place_formatted ??
        feature.place_name ??
        "Location",
      longitude: coords?.[0] ?? 0,
      latitude: coords?.[1] ?? 0,
      source: "mapbox" as const,
    };
  });
}

async function osmSearch(query: string): Promise<Place[]> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "6",
    countrycodes: "in",
    addressdetails: "1",
  });

  const response = await fetchWithTimeout(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
    // Nominatim's usage policy requires a descriptive User-Agent.
    "User-Agent": "X-FARM-AI/1.0 (agriculture platform; contact: support@xfarm.ai)",
    Accept: "application/json",
  });
  if (!response.ok) throw new Error(`nominatim ${response.status}`);

  const payload = (await response.json()) as Array<{
    place_id: number;
    display_name: string;
    name?: string;
    lat: string;
    lon: string;
  }>;

  return payload.map((row) => ({
    id: `osm-${row.place_id}`,
    name: row.name || row.display_name.split(",")[0],
    fullName: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
    source: "openstreetmap" as const,
  }));
}

export async function searchPlaces(
  query: string,
  proximity?: [number, number],
): Promise<GeocodeOutcome> {
  const trimmed = query.trim();
  if (trimmed.length < 3) {
    return { ok: false, reason: "empty_query", message: "Type at least three letters." };
  }

  try {
    if (isMapboxConfigured()) {
      const places = await mapboxSearch(trimmed, proximity);
      return { ok: true, places };
    }
    const places = await osmSearch(trimmed);
    return { ok: true, places };
  } catch {
    return { ok: false, reason: "unavailable", message: "Map service is temporarily unavailable." };
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<Place | null> {
  try {
    if (isMapboxConfigured()) {
      const params = new URLSearchParams({
        longitude: String(longitude),
        latitude: String(latitude),
        access_token: publicEnv.mapboxToken,
        language: "en",
      });
      const response = await fetchWithTimeout(
        `https://api.mapbox.com/search/geocode/v6/reverse?${params.toString()}`,
      );
      if (!response.ok) return null;
      const payload = (await response.json()) as {
        features?: Array<{
          id?: string;
          properties?: { name?: string; full_address?: string; place_formatted?: string };
        }>;
      };
      const feature = payload.features?.[0];
      if (!feature) return null;
      return {
        id: feature.id ?? "mapbox-reverse",
        name: feature.properties?.name ?? "Location",
        fullName: feature.properties?.full_address ?? feature.properties?.place_formatted ?? "Location",
        latitude,
        longitude,
        source: "mapbox",
      };
    }

    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: "jsonv2",
      zoom: "14",
    });
    const response = await fetchWithTimeout(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        "User-Agent": "X-FARM-AI/1.0 (agriculture platform; contact: support@xfarm.ai)",
        Accept: "application/json",
      },
    );
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      place_id?: number;
      display_name?: string;
      name?: string;
    };
    return {
      id: `osm-${payload.place_id ?? "reverse"}`,
      name: payload.name || payload.display_name?.split(",")[0] || "Location",
      fullName: payload.display_name ?? "Location",
      latitude,
      longitude,
      source: "openstreetmap",
    };
  } catch {
    return null;
  }
}

export interface MapConfig {
  provider: "mapbox" | "openstreetmap";
  token: string | null;
  style: string;
}

/** Client-safe map configuration (the Mapbox token is a public token by design). */
export function getMapConfig(): MapConfig {
  if (isMapboxConfigured()) {
    return {
      provider: "mapbox",
      token: publicEnv.mapboxToken,
      style: "mapbox://styles/mapbox/satellite-streets-v12",
    };
  }
  return {
    provider: "openstreetmap",
    token: null,
    style: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  };
}
