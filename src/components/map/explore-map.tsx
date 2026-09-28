"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, Search, Tractor, Store, Wheat } from "lucide-react";
import { Badge, Callout } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { canGeocodeInBrowser, searchPlacesInBrowser } from "@/lib/maps/browser-search";
import { InteractiveMap } from "./interactive-map";

export interface ExplorePin {
  id: string;
  title: string;
  latitude: number;
  longitude: number;
  district?: string | null;
  village?: string | null;
  kind?: string;
  pricePerUnit?: number | string | null;
  unit?: string | null;
}

interface Place {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

/** Cookie attributes for client-set preference/location cookies. */
function cookieAttributes(maxAgeSeconds: number): string {
  // `secure` only on HTTPS: browsers reject Secure cookies on plain http://localhost.
  const secure = typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  return `path=/; max-age=${maxAgeSeconds}; samesite=lax${secure}`;
}

function writeLocationCookies(latitude: number, longitude: number, label: string) {
  const base = cookieAttributes(COOKIE_MAX_AGE);
  document.cookie = `xfarm-lat=${latitude.toFixed(4)}; ${base}`;
  document.cookie = `xfarm-lon=${longitude.toFixed(4)}; ${base}`;
  document.cookie = `xfarm-place=${encodeURIComponent(label)}; ${base}`;
}

/**
 * Full-screen style map explorer: search a place, filter pins by listing type,
 * drop your own pin and use it for weather/soil context.
 */
export function ExploreMap({
  pins,
  engine,
  token,
  initialCentre,
}: {
  pins: ExplorePin[];
  engine: "mapbox" | "openstreetmap";
  token: string | null;
  initialCentre: { latitude: number; longitude: number } | null;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "produce" | "input" | "machinery" | "service">("all");
  const [centre, setCentre] = useState<{ latitude: number; longitude: number } | null>(initialCentre);
  const [selected, setSelected] = useState<{ latitude: number; longitude: number } | null>(initialCentre);
  const [locating, setLocating] = useState(false);
  const [usedBrowserSearch, setUsedBrowserSearch] = useState(false);

  const visiblePins = filter === "all" ? pins : pins.filter((pin) => pin.kind === filter);

  /**
   * Last resort for address search: the server-side proxy could not reach a
   * geocoder, but the visitor's browser can. Only public `pk.` tokens are used.
   */
  async function searchInBrowser(query: string): Promise<boolean> {
    const publicToken = token;
    if (!canGeocodeInBrowser(publicToken)) return false;
    try {
      const found = await searchPlacesInBrowser(query, publicToken, centre);
      if (found.length === 0) return false;
      setPlaces(found);
      setUsedBrowserSearch(true);
      setSearchError(null);
      setCentre({ latitude: found[0].latitude, longitude: found[0].longitude });
      return true;
    } catch {
      return false;
    }
  }

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setSearchError(t("map.searchHint"));
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`, { cache: "no-store" });
      const payload = (await response.json()) as { ok?: boolean; places?: Place[] };
      if (response.ok && payload.ok) {
        const found = payload.places ?? [];
        setPlaces(found);
        setUsedBrowserSearch(false);
        if (found.length === 0) setSearchError(t("map.noSearchResults"));
        if (found[0]) setCentre({ latitude: found[0].latitude, longitude: found[0].longitude });
        return;
      }
      if (!(await searchInBrowser(trimmed))) setSearchError(t("errors.network"));
    } catch {
      if (!(await searchInBrowser(trimmed))) setSearchError(t("errors.network"));
    } finally {
      setSearching(false);
    }
  }

  function useMyLocation() {
    if (!("geolocation" in navigator)) {
      setSearchError(t("map.geolocationUnsupported"));
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCentre({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setSelected({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setSearchError(t("map.geolocationDenied"));
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  function useSelected() {
    if (!selected) return;
    writeLocationCookies(selected.latitude, selected.longitude, t("map.selectedPlace"));
    router.push("/weather?saved=1");
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
      <div className="space-y-3">
        <form onSubmit={runSearch} className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("map.searchPlaceholder")}
            aria-label={t("map.searchPlaceholder")}
            className="min-h-[var(--tap-min)] w-full rounded-xl border border-ink-200 px-3.5"
          />
          <button
            type="submit"
            aria-label={t("common.search")}
            className="inline-flex min-h-[var(--tap-min)] items-center gap-2 rounded-xl bg-field-700 px-4 text-sm font-semibold text-white"
          >
            {searching ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
          </button>
        </form>

        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white text-sm font-semibold text-ink-700 hover:border-field-300"
        >
          {locating ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
          {t("map.useMyLocation")}
        </button>

        {searchError ? <Callout tone="warning" title={t("map.title")}>{searchError}</Callout> : null}
        {usedBrowserSearch ? <p className="text-xs text-ink-500">{t("map.browserSearchNote")}</p> : null}

        {places.length > 0 ? (
          <ul className="space-y-1.5">
            {places.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => {
                    setCentre({ latitude: place.latitude, longitude: place.longitude });
                    setSelected({ latitude: place.latitude, longitude: place.longitude });
                  }}
                  className="w-full rounded-xl border border-ink-100 px-3 py-2 text-left text-sm hover:border-field-300 hover:bg-field-50"
                >
                  <span className="block truncate font-medium text-ink-800">{place.name}</span>
                  <span className="block truncate text-xs text-ink-500">{place.fullName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { value: "all", label: t("market.allCategories"), icon: MapPin },
              { value: "produce", label: t("market.kind.produce"), icon: Wheat },
              { value: "input", label: t("market.kind.input"), icon: Store },
              { value: "machinery", label: t("market.kind.machinery"), icon: Tractor },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  filter === item.value
                    ? "border-field-600 bg-field-700 text-white"
                    : "border-ink-200 bg-white text-ink-600 hover:border-field-300"
                }`}
              >
                <Icon className="size-3.5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <p className="text-xs text-ink-500">
          {visiblePins.length} {t("map.pinsShown")}
        </p>

        {selected ? (
          <div className="rounded-xl border border-ink-200 p-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink-800">
              <MapPin className="size-4 text-field-600" aria-hidden />
              {t("map.selectedLocation")}
            </p>
            <p className="mt-1 font-mono text-xs text-ink-500">
              {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
            </p>
            <button
              type="button"
              onClick={useSelected}
              className="mt-2.5 inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-field-700 px-3 text-sm font-semibold text-white"
            >
              {t("map.useForWeather")}
            </button>
          </div>
        ) : (
          <p className="text-xs text-ink-500">{t("map.tapToSelect")}</p>
        )}

        {engine === "openstreetmap" ? (
          <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-500">{t("map.tokenMissing")}</p>
        ) : null}
      </div>

      <div className="space-y-3">
        <InteractiveMap
          markers={visiblePins.map((pin) => ({
            id: pin.id,
            latitude: pin.latitude,
            longitude: pin.longitude,
            title: pin.title,
            subtitle: [pin.village, pin.district].filter(Boolean).join(", "),
            kind: pin.kind,
          }))}
          center={centre}
          zoom={centre ? 11 : 6}
          engine={engine}
          token={token}
          className="h-[24rem] lg:h-[32rem]"
          fitMarkers={visiblePins.length > 1 && !centre}
          selectable
          onSelect={(coordinates) => setSelected(coordinates)}
        />
        <div className="flex flex-wrap gap-2">
          <Badge tone="green">{t("market.kind.produce")}</Badge>
          <Badge tone="blue">{t("market.kind.input")}</Badge>
          <Badge tone="amber">{t("market.kind.machinery")}</Badge>
          <Badge tone="neutral">{t("market.kind.service")}</Badge>
        </div>
      </div>
    </div>
  );
}
