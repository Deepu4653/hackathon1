"use client";

import { InteractiveMap, type MapMarker } from "./interactive-map";

/**
 * Marketplace/listing map: a thin wrapper so listing screens do not care how the
 * underlying map engine is chosen (Mapbox when a token exists, OpenStreetMap
 * otherwise — decided on the server and passed in).
 */
export function MarketMap({
  markers,
  center,
  zoom = 11,
  engine = "openstreetmap",
  token = null,
  className,
  fitMarkers = true,
}: {
  markers: MapMarker[];
  center?: { latitude: number; longitude: number } | null;
  zoom?: number;
  engine?: "mapbox" | "openstreetmap";
  token?: string | null;
  className?: string;
  fitMarkers?: boolean;
}) {
  return (
    <InteractiveMap
      markers={markers}
      center={center}
      zoom={zoom}
      engine={engine}
      token={token}
      className={className}
      fitMarkers={fitMarkers}
    />
  );
}
