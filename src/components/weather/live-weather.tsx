"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Wifi } from "lucide-react";
import { Callout, Card, CardBody } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { buildSnapshot, forecastUrl, type WeatherSnapshot } from "@/lib/weather/open-meteo";
import { WeatherPanel } from "./weather-panel";

type LiveState =
  | { status: "loading" }
  | { status: "ready"; snapshot: WeatherSnapshot }
  | { status: "failed" };

/**
 * Weather straight from Open-Meteo, fetched by the visitor's browser.
 *
 * Used only when the server could not reach Open-Meteo itself (a sandbox or a
 * locked-down host with no outbound internet). The URL and the mapping are the
 * exact ones `fetchWeather()` uses, so the numbers are identical to what the
 * server would have produced — nothing is estimated, and the panel says so.
 */
export function LiveWeather({
  latitude,
  longitude,
  compact = false,
}: {
  latitude: number;
  longitude: number;
  compact?: boolean;
}) {
  const { t, locale } = useI18n();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; state: LiveState } | null>(null);

  // A change of location or a retry invalidates the stored result, so the panel
  // shows "loading" again without an extra render pass.
  const requestKey = `${latitude}|${longitude}|${attempt}`;
  const state: LiveState = result?.key === requestKey ? result.state : { status: "loading" };

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch(forecastUrl(latitude, longitude), {
          cache: "no-store",
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`open-meteo ${response.status}`);
        const payload = (await response.json()) as Record<string, unknown>;
        if (cancelled) return;
        setResult({
          key: `${latitude}|${longitude}|${attempt}`,
          state: { status: "ready", snapshot: buildSnapshot(payload, latitude, longitude) },
        });
      } catch {
        if (!cancelled) {
          setResult({ key: `${latitude}|${longitude}|${attempt}`, state: { status: "failed" } });
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [latitude, longitude, attempt]);

  if (state.status === "loading") {
    return (
      <Card>
        <CardBody className="flex items-center gap-2 text-sm text-ink-600">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          <span aria-live="polite">{t("common.loading")}</span>
        </CardBody>
      </Card>
    );
  }

  if (state.status === "failed") {
    return (
      <Callout tone="warning" title={t("weather.unavailable")}>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="font-semibold underline"
        >
          {t("common.retry")}
        </button>
      </Callout>
    );
  }

  return (
    <div className="space-y-3">
      <p className="flex items-start gap-2 rounded-xl border border-info-100 bg-info-50 px-3 py-2 text-xs leading-relaxed text-info-600">
        <Wifi className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{t("weather.browserFetchNote")}</span>
      </p>

      <WeatherPanel snapshot={state.snapshot} t={t} locale={locale} compact={compact} />

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 text-xs font-semibold text-ink-800 hover:border-field-300"
        >
          <RefreshCw className="size-3.5" aria-hidden />
          {t("weather.refreshNow")}
        </button>
        <span className="text-xs text-ink-500">
          {t("common.updated")}: {new Date(state.snapshot.observedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </div>
  );
}
