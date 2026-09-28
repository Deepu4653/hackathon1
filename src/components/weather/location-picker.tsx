"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

interface Place {
  id: string;
  name: string;
  fullName: string;
  latitude: number;
  longitude: number;
}

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180;

function writeLocationCookies(latitude: number, longitude: number, label: string) {
  const base = `path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
  document.cookie = `xfarm-lat=${latitude.toFixed(4)}; ${base}`;
  document.cookie = `xfarm-lon=${longitude.toFixed(4)}; ${base}`;
  document.cookie = `xfarm-place=${encodeURIComponent(label)}; ${base}`;
}

/**
 * Location selection for weather.
 *
 * The chosen location is stored in first-party cookies (no account needed) and
 * can be pinned to a farm. Nothing is hard-coded: a brand-new visitor is asked
 * where they are instead of being shown somebody else's weather.
 */
export function LocationPicker({
  currentLabel,
  currentLatitude,
  currentLongitude,
  farms,
  compact = false,
}: {
  currentLabel: string | null;
  currentLatitude: number | null;
  currentLongitude: number | null;
  farms: Array<{ id: string; name: string; latitude: number | null; longitude: number | null; village: string | null }>;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [, startTransition] = useTransition();

  async function runSearch(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) {
      setError(t("map.noSearchResults"));
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { ok: boolean; places?: Place[]; error?: string };
      if (!payload.ok) {
        setError(payload.error ?? t("errors.map"));
        setPlaces([]);
      } else {
        setPlaces(payload.places ?? []);
        if ((payload.places ?? []).length === 0) setError(t("map.noSearchResults"));
      }
    } catch {
      setError(t("errors.map"));
    } finally {
      setSearching(false);
    }
  }

  function choose(place: Place) {
    writeLocationCookies(place.latitude, place.longitude, place.name);
    setPlaces([]);
    setQuery("");
    startTransition(() => router.refresh());
  }

  function useDeviceLocation() {
    if (!("geolocation" in navigator)) {
      setError(t("errors.map"));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        writeLocationCookies(
          position.coords.latitude,
          position.coords.longitude,
          `${position.coords.latitude.toFixed(2)}, ${position.coords.longitude.toFixed(2)}`,
        );
        setLocating(false);
        startTransition(() => router.refresh());
      },
      () => {
        setLocating(false);
        setError(t("errors.map"));
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  const localeTag = locale === "te" ? "te-IN" : locale === "hi" ? "hi-IN" : "en-IN";
  const coords =
    currentLatitude !== null && currentLongitude !== null
      ? `${currentLatitude.toFixed(3)}, ${currentLongitude.toFixed(3)}`
      : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-field-50 px-3 py-2 text-sm font-semibold text-field-800">
          <MapPin className="size-4" aria-hidden />
          {currentLabel ?? t("weather.selectLocation")}
          {coords ? <span className="font-mono text-xs font-normal text-field-700">{coords}</span> : null}
        </span>
        <button
          type="button"
          onClick={useDeviceLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm font-semibold text-ink-700 hover:border-field-300"
        >
          {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />}
          {t("weather.useDevice")}
        </button>
      </div>

      {farms.filter((farm) => farm.latitude !== null).length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {farms
            .filter((farm) => farm.latitude !== null && farm.longitude !== null)
            .map((farm) => (
              <button
                key={farm.id}
                type="button"
                onClick={() => {
                  writeLocationCookies(farm.latitude as number, farm.longitude as number, farm.name);
                  startTransition(() => router.refresh());
                }}
                className="rounded-full border border-field-200 bg-field-50 px-3 py-1.5 text-xs font-semibold text-field-800 hover:border-field-400"
              >
                {t("weather.useMyFarm")}: {farm.name}
              </button>
            ))}
        </div>
      ) : null}

      {!compact ? (
        <form onSubmit={runSearch} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400" aria-hidden />
            <input
              aria-label={t("map.search")}
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("map.searchPlaceholder")}
              autoComplete="off"
              className="w-full rounded-xl border border-ink-200 bg-white py-2.5 pl-9 pr-3.5 text-base"
              style={{ minHeight: "var(--tap-min)" }}
            />
          </div>
          <button
            type="submit"
            disabled={searching}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-field-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-field-800"
          >
            {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {t("map.search")}
          </button>
        </form>
      ) : null}

      {error ? <p className="text-sm font-medium text-danger-600">{error}</p> : null}

      {places.length > 0 ? (
        <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
          {places.map((place) => (
            <li key={place.id}>
              <button
                type="button"
                onClick={() => choose(place)}
                className="flex w-full items-start gap-2 px-3.5 py-3 text-left hover:bg-field-50"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-field-600" aria-hidden />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-ink-800">{place.name}</span>
                  <span className="block truncate text-xs text-ink-500">{place.fullName}</span>
                  <span className="mt-0.5 block font-mono text-[0.7rem] text-ink-400">
                    {place.latitude.toFixed(3)}, {place.longitude.toFixed(3)} · {new Date().toLocaleDateString(localeTag)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
