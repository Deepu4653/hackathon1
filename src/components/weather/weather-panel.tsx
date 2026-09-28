import {
  CloudRain,
  Droplets,
  Sun,
  Sunrise,
  Thermometer,
  TriangleAlert,
  Wind,
} from "lucide-react";
import { Badge, Callout, Card, CardBody, CardHeader, formatDateTime, formatNumber } from "@/components/ui";
import type { Translator } from "@/lib/i18n";
import type { WeatherSnapshot } from "@/lib/weather/open-meteo";

const ALERT_LABEL: Record<string, { key: Parameters<Translator>[0]; tone: "info" | "warning" | "critical" }> = {
  rain_today: { key: "weather.rainToday", tone: "info" },
  heavy_rain: { key: "weather.rainToday", tone: "warning" },
  high_wind: { key: "weather.highWind", tone: "warning" },
  heat: { key: "weather.heat" as never, tone: "warning" },
  humidity: { key: "weather.humidityHigh", tone: "info" },
  spray_caution: { key: "weather.sprayCaution", tone: "warning" },
  dry_spell: { key: "weather.drySpell", tone: "info" },
};

function dayLabel(date: string, locale: string, todayLabel: string, tomorrowLabel: string, index: number) {
  if (index === 0) return todayLabel;
  if (index === 1) return tomorrowLabel;
  return new Date(date).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short" });
}

export function WeatherPanel({
  snapshot,
  t,
  locale,
  compact = false,
}: {
  snapshot: WeatherSnapshot;
  t: Translator;
  locale: string;
  compact?: boolean;
}) {
  const { current, daily } = snapshot;

  const metrics = [
    {
      icon: Thermometer,
      label: t("weather.temperature"),
      value: current.temperatureC !== null ? `${formatNumber(current.temperatureC, 1)}°C` : t("common.notAvailable"),
      hint: current.feelsLikeC !== null ? `${t("weather.feelsLike")} ${formatNumber(current.feelsLikeC, 1)}°C` : undefined,
    },
    {
      icon: CloudRain,
      label: t("weather.rainChance"),
      value:
        current.rainProbabilityPct !== null
          ? `${Math.round(current.rainProbabilityPct)}%`
          : t("common.notAvailable"),
      hint: current.precipitationMm !== null ? `${t("weather.precipitation")}: ${formatNumber(current.precipitationMm, 1)} mm` : undefined,
    },
    {
      icon: Droplets,
      label: t("weather.humidity"),
      value: current.humidityPct !== null ? `${Math.round(current.humidityPct)}%` : t("common.notAvailable"),
    },
    {
      icon: Wind,
      label: t("weather.wind"),
      value: current.windKph !== null ? `${formatNumber(current.windKph, 0)} km/h` : t("common.notAvailable"),
      hint:
        current.windDirectionDeg !== null && current.windDirectionDeg !== undefined
          ? `${Math.round(current.windDirectionDeg)}°`
          : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          icon={<Sun className="size-5" aria-hidden />}
          title={current.conditionText}
          subtitle={`${current.temperatureC !== null ? `${formatNumber(current.temperatureC, 1)}°C` : ""} · ${t("weather.fetchedAt")} ${formatDateTime(snapshot.observedAt, locale)}`}
          action={<Badge tone="green">{t("weather.dataSource")}</Badge>}
        />
        <CardBody>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map((metric) => {
              const Icon = metric.icon;
              return (
                <div key={metric.label} className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-ink-500">
                    <Icon className="size-3.5" aria-hidden />
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-ink-900 sm:text-2xl">{metric.value}</p>
                  {metric.hint ? <p className="mt-0.5 text-xs text-ink-500">{metric.hint}</p> : null}
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {snapshot.alerts.length > 0 ? (
        <div className="space-y-2">
          {snapshot.alerts.map((alert) => {
            const meta = ALERT_LABEL[alert.code];
            const label = meta ? t(meta.key) : alert.code;
            return (
              <Callout
                key={`${alert.code}-${alert.detail}`}
                tone={alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "warning" : "info"}
                icon={<TriangleAlert className="size-4" aria-hidden />}
                title={alert.detail ? `${label} · ${alert.detail}` : label}
              />
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-field-50 px-3.5 py-2.5 text-sm font-medium text-field-800">
          {t("weather.noAlerts")}
        </p>
      )}

      {!compact ? (
        <Card>
          <CardHeader icon={<Sunrise className="size-5" aria-hidden />} title={t("weather.forecast")} />
          <CardBody className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {daily.slice(0, 7).map((day, index) => (
                <div
                  key={day.date}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800">
                      {dayLabel(day.date, locale, t("weather.today"), t("weather.tomorrow"), index)}
                    </p>
                    <p className="truncate text-xs text-ink-500">{day.conditionText}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900">
                      {day.tempMaxC !== null ? `${Math.round(day.tempMaxC)}°` : "—"}
                      <span className="font-normal text-ink-400"> / {day.tempMinC !== null ? `${Math.round(day.tempMinC)}°` : "—"}</span>
                    </p>
                    <p className="text-xs text-field-700">
                      {day.rainProbabilityPct !== null ? `${Math.round(day.rainProbabilityPct)}%` : "—"}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {snapshot.hourly.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <caption className="sr-only">{t("weather.forecast")}</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                      <th scope="col" className="py-2">{t("common.date")}</th>
                      <th scope="col" className="py-2">{t("weather.temperature")}</th>
                      <th scope="col" className="py-2">{t("weather.rainChance")}</th>
                      <th scope="col" className="py-2">{t("weather.precipitation")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.hourly.slice(0, 12).map((hour) => (
                      <tr key={hour.time} className="border-t border-ink-100">
                        <td className="py-1.5 text-ink-600">
                          {new Date(hour.time).toLocaleTimeString(locale, { hour: "numeric" })}
                        </td>
                        <td className="py-1.5 font-medium text-ink-800">
                          {hour.temperatureC !== null ? `${formatNumber(hour.temperatureC, 1)}°C` : "—"}
                        </td>
                        <td className="py-1.5 text-field-700">
                          {hour.rainProbabilityPct !== null ? `${Math.round(hour.rainProbabilityPct)}%` : "—"}
                        </td>
                        <td className="py-1.5 text-ink-600">
                          {hour.precipitationMm !== null ? `${formatNumber(hour.precipitationMm, 1)} mm` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}
    </div>
  );
}
