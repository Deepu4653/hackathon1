import { CloudSun, MapPin, Save } from "lucide-react";
import { Callout, Card, CardBody, CardHeader, PageHeader, formatDateTime } from "@/components/ui";
import { LocationPicker } from "@/components/weather/location-picker";
import { LiveWeather } from "@/components/weather/live-weather";
import { WeatherPanel } from "@/components/weather/weather-panel";
import { SubmitButton } from "@/components/forms";
import { getSessionUser } from "@/lib/auth/session";
import { getTranslatorForRequest } from "@/lib/preferences";
import { fetchWeather } from "@/lib/weather/open-meteo";
import { resolveWeatherLocation } from "@/lib/weather/location";
import { getMapConfig } from "@/lib/maps/geocode";
import { listFarms } from "@/lib/repos/farms";
import { getLatestStoredWeather } from "@/lib/weather/weather-repo";
import { saveWeatherAction } from "@/app/actions/weather";
import { pageMetadata } from "@/lib/i18n/metadata";

export const generateMetadata = pageMetadata("weather.title");

export default async function WeatherPage() {
  const user = await getSessionUser();
  const { t, locale } = await getTranslatorForRequest(user?.profile.simple_mode);
  const location = await resolveWeatherLocation(user?.id ?? null);
  const farms = user ? await listFarms(user.id) : [];
  const mapConfig = getMapConfig();

  const hasLocation = Number.isFinite(location.latitude) && Number.isFinite(location.longitude);
  const outcome = hasLocation ? await fetchWeather(location.latitude, location.longitude) : null;

  // If Open-Meteo is unreachable, fall back to the last snapshot WE fetched and
  // stored for this farm — labelled as such, never invented.
  const storedFallback =
    !outcome?.ok && location.farm ? await getLatestStoredWeather(location.farm.id) : null;

  return (
    <div>
      <PageHeader
        title={t("weather.title")}
        subtitle={t("weather.subtitle")}
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-field-50 px-3 py-1 text-xs font-semibold text-field-800">
            <CloudSun className="size-3.5" aria-hidden />
            {t("weather.dataSource")}
          </span>
        }
      />

      <Card className="mb-4">
        <CardHeader
          icon={<MapPin className="size-5" aria-hidden />}
          title={t("weather.selectLocation")}
          subtitle={t("weather.useMyFarm")}
        />
        <CardBody>
          <LocationPicker
            currentLabel={location.label}
            currentLatitude={hasLocation ? location.latitude : null}
            currentLongitude={hasLocation ? location.longitude : null}
            mapboxToken={mapConfig.token}
            farms={farms.map((farm) => ({
              id: farm.id,
              name: farm.name,
              latitude: farm.latitude,
              longitude: farm.longitude,
              village: farm.village,
            }))}
          />
        </CardBody>
      </Card>

      {!hasLocation ? (
        <Callout tone="info" title={t("weather.selectLocation")}>
          {t("weather.noAlerts")}
        </Callout>
      ) : outcome?.ok ? (
        <div className="space-y-4">
          <WeatherPanel snapshot={outcome.snapshot} t={t} locale={locale} />

          {user && location.farm ? (
            <form action={saveWeatherAction} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="farmId" value={location.farm.id} />
              <input type="hidden" name="latitude" value={location.latitude} />
              <input type="hidden" name="longitude" value={location.longitude} />
              <SubmitButton variant="secondary">
                <Save className="size-4" aria-hidden />
                {t("weather.saveToFarm")}
              </SubmitButton>
              <span className="text-xs text-ink-500">
                {t("common.source")}: {t("weather.dataSource")} · {formatDateTime(outcome.snapshot.observedAt, locale)}
              </span>
            </form>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <LiveWeather latitude={location.latitude} longitude={location.longitude} />

          {storedFallback ? (
            <div className="space-y-3">
              <Callout tone="warning" title={t("weather.unavailable")}>
                {t("common.source")}: {storedFallback.source} · {formatDateTime(storedFallback.observed_at, locale)}
              </Callout>
              <Card>
                <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Metric label={t("weather.temperature")} value={storedFallback.temperature_c ? `${storedFallback.temperature_c}°C` : "—"} />
                  <Metric label={t("weather.humidity")} value={storedFallback.humidity_pct ? `${storedFallback.humidity_pct}%` : "—"} />
                  <Metric label={t("weather.wind")} value={storedFallback.wind_kph ? `${storedFallback.wind_kph} km/h` : "—"} />
                  <Metric
                    label={t("weather.rainChance")}
                    value={storedFallback.rain_probability_pct ? `${storedFallback.rain_probability_pct}%` : "—"}
                  />
                </CardBody>
              </Card>

            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-ink-100 bg-ink-50/60 p-3">
      <p className="text-xs font-medium text-ink-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-ink-900">{value}</p>
    </div>
  );
}
