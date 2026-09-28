/**
 * Browser-side Mapbox geocoding fallback.
 *
 * The normal path for address search is `/api/geocode`, so the token stays on
 * the server. When the SERVER itself has no outbound internet (a sandbox or a
 * locked-down host) the proxy fails even though the visitor's browser has a
 * perfectly good connection, so the browser asks Mapbox directly.
 *
 * Only public `pk.` tokens — the ones Mapbox designs to be shipped to the
 * browser — are ever sent from here. A secret (`sk.`) token is never used.
 */

export interface BrowserPlace {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

interface MapboxFeature {
  id?: string;
  text?: string;
  place_name?: string;
  center?: [number, number];
}

/** True when the configured token is a public token that is safe in a browser. */
export function canGeocodeInBrowser(token: string | null | undefined): token is string {
  return typeof token === "string" && token.startsWith("pk.");
}

/** Mapbox geocoding over HTTPS from the visitor's browser. Throws on failure. */
export async function searchPlacesInBrowser(
  query: string,
  token: string,
  proximity?: { latitude: number; longitude: number } | null,
): Promise<BrowserPlace[]> {
  const params = new URLSearchParams({
    access_token: token,
    limit: "6",
    country: "in",
    language: "en",
    types: "place,locality,district,region,neighbourhood,address,poi",
  });
  if (proximity) params.set("proximity", `${proximity.longitude},${proximity.latitude}`);

  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params.toString()}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!response.ok) throw new Error(`mapbox geocoding ${response.status}`);

  const payload = (await response.json()) as { features?: MapboxFeature[] };
  return (payload.features ?? [])
    .filter((feature) => Array.isArray(feature.center) && feature.center.length === 2)
    .map((feature, index) => {
      const center = feature.center as [number, number];
      return {
        id: feature.id ?? `mapbox-${index}`,
        name: feature.text ?? feature.place_name ?? query,
        fullName: feature.place_name ?? feature.text ?? query,
        latitude: center[1],
        longitude: center[0],
      };
    });
}
