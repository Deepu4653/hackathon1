"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, MapPin } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

export interface MapMarker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  subtitle?: string | null;
  kind?: "produce" | "input" | "machinery" | "service" | "farm" | "point" | string;
}

export type MapEngine = "mapbox" | "openstreetmap";

const MARKER_COLOURS: Record<string, string> = {
  produce: "#2f7d32",
  input: "#1f6f9c",
  machinery: "#b3651a",
  service: "#6b4fa8",
  farm: "#2f7d32",
};

/**
 * Interactive map with graceful degradation.
 *
 * Mapbox is used when NEXT_PUBLIC_MAPBOX_TOKEN is configured; otherwise the same
 * component renders OpenStreetMap raster tiles (Leaflet) so the feature is never
 * "missing" just because a token is absent. If the tile provider itself cannot be
 * reached, the farmer sees a plain explanation instead of a broken widget —
 * the page around it keeps working.
 */
export function InteractiveMap({
  markers = [],
  center,
  zoom = 11,
  engine = "openstreetmap",
  token,
  className = "h-80",
  fitMarkers = false,
  selectable = false,
  onSelect,
  showAttribution = true,
}: {
  markers?: MapMarker[];
  center?: { latitude: number; longitude: number } | null;
  zoom?: number;
  engine?: MapEngine;
  token?: string | null;
  className?: string;
  fitMarkers?: boolean;
  selectable?: boolean;
  onSelect?: (coordinates: { latitude: number; longitude: number }) => void;
  showAttribution?: boolean;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<{ remove: () => void } | null>(null);
  const markerRefs = useRef<Array<{ remove: () => void }>>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const initialCenter =
    center ?? (markers[0] ? { latitude: markers[0].latitude, longitude: markers[0].longitude } : { latitude: 16.5, longitude: 80.6 });
  const markerKey = markers.map((marker) => `${marker.id}:${marker.latitude}:${marker.longitude}`).join("|");

  useEffect(() => {
    let cancelled = false;

    async function initLeaflet() {
      setStatus("loading");
      const L = await import("leaflet");
      await import("leaflet/dist/leaflet.css");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: [initialCenter.latitude, initialCenter.longitude],
        zoom,
        attributionControl: showAttribution,
      });

      const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "© OpenStreetMap contributors",
      });
      tiles.on("tileerror", () => {
        if (!cancelled) setStatus("error");
      });
      tiles.addTo(map);

      for (const marker of markers) {
        const circle = L.circleMarker([marker.latitude, marker.longitude], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: MARKER_COLOURS[marker.kind ?? "point"] ?? "#2f7d32",
          fillOpacity: 1,
        }).addTo(map);
        circle.bindPopup(
          `<strong>${escapeHtml(marker.title)}</strong>${
            marker.subtitle ? `<br><span style="font-size:11px">${escapeHtml(marker.subtitle)}</span>` : ""
          }`,
        );
        markerRefs.current.push(circle);
      }

      if (fitMarkers && markers.length > 1) {
        map.fitBounds(
          markers.map((marker) => [marker.latitude, marker.longitude]) as Array<[number, number]>,
          { padding: [40, 40], maxZoom: 14 },
        );
      }

      if (selectable) {
        map.on("click", (event: { latlng: { lat: number; lng: number } }) => {
          onSelect?.({ latitude: event.latlng.lat, longitude: event.latlng.lng });
        });
      }

      mapRef.current = map;
      setStatus("ready");
    }

    async function initMapbox() {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled || !containerRef.current || !token) return;

      mapboxgl.accessToken = token;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/satellite-streets-v12",
        center: [initialCenter.longitude, initialCenter.latitude],
        zoom,
        attributionControl: showAttribution,
      });

      map.on("error", () => {
        if (!cancelled) setStatus("error");
      });
      map.on("load", () => {
        if (!cancelled) setStatus("ready");
      });

      for (const marker of markers) {
        const element = document.createElement("div");
        element.style.cssText = `width:18px;height:18px;border-radius:9999px;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);background:${
          MARKER_COLOURS[marker.kind ?? "point"] ?? "#2f7d32"
        }`;
        const popup = new mapboxgl.Popup({ offset: 14 }).setHTML(
          `<strong>${escapeHtml(marker.title)}</strong>${
            marker.subtitle ? `<br><span style="font-size:11px">${escapeHtml(marker.subtitle)}</span>` : ""
          }`,
        );
        const instance = new mapboxgl.Marker({ element })
          .setLngLat([marker.longitude, marker.latitude])
          .setPopup(popup);
        instance.addTo(map);
        markerRefs.current.push(instance);
      }

      if (fitMarkers && markers.length > 1) {
        const bounds = new mapboxgl.LngLatBounds();
        for (const marker of markers) bounds.extend([marker.longitude, marker.latitude]);
        map.fitBounds(bounds, { padding: 48, maxZoom: 14 });
      }

      if (selectable) {
        map.on("click", (event: { lngLat: { lat: number; lng: number } }) => {
          onSelect?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
        });
      }

      mapRef.current = map;
    }

    const start = engine === "mapbox" && token ? initMapbox : initLeaflet;
    start().catch((error) => {
      console.warn("[map] could not initialise", error);
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
      for (const marker of markerRefs.current) {
        try {
          marker.remove();
        } catch {
          /* already detached */
        }
      }
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, token, zoom, selectable, fitMarkers, showAttribution, markerKey, initialCenter.latitude, initialCenter.longitude]);

  return (
    <div className={`relative w-full overflow-hidden rounded-[var(--radius-card)] border border-ink-200 bg-field-50 ${className}`}>
      <div ref={containerRef} className="size-full" role="application" aria-label={t("map.title")} />

      {status === "loading" ? (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-field-50/70">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-ink-600 shadow">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            {t("map.loading")}
          </span>
        </div>
      ) : null}

      {status === "error" ? (
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start gap-2 rounded-xl border border-soil-200 bg-white px-3 py-2 text-sm text-ink-700 shadow">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-soil-600" aria-hidden />
          {t("map.tilesUnavailable")}
        </div>
      ) : null}

      {engine !== "mapbox" ? (
        <p className="pointer-events-none absolute bottom-1 right-1 rounded bg-white/85 px-1.5 text-[0.6rem] text-ink-500">
          <MapPin className="mr-0.5 inline size-3" aria-hidden />
          {t("map.attribution")}
        </p>
      ) : null}
    </div>
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
