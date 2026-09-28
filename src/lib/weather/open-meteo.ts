/**
 * Open-Meteo integration.
 *
 * Free, keyless, and the only source of weather in X-FARM AI. Nothing here is
 * ever synthesised: if the request fails, the caller shows "Weather data is
 * temporarily unavailable." rather than a made-up number.
 *
 * `forecastUrl()` and `buildSnapshot()` are pure and import-safe in the browser:
 * when a deployment's SERVER has no outbound internet (some sandboxes only allow
 * the npm registry), <LiveWeather> asks Open-Meteo from the visitor's browser
 * instead — same provider, same endpoint, same mapping, real data either way.
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 10 * 60 * 1000;

export interface WeatherAlert {
  code: "rain_today" | "heavy_rain" | "high_wind" | "heat" | "humidity" | "spray_caution" | "dry_spell";
  severity: "info" | "warning" | "critical";
  detail: string;
}

export interface WeatherDay {
  date: string;
  conditionCode: number;
  conditionText: string;
  tempMaxC: number | null;
  tempMinC: number | null;
  precipitationSumMm: number | null;
  rainProbabilityPct: number | null;
  windMaxKph: number | null;
}

export interface WeatherHour {
  time: string;
  temperatureC: number | null;
  rainProbabilityPct: number | null;
  precipitationMm: number | null;
}

export interface WeatherSnapshot {
  latitude: number;
  longitude: number;
  timezone: string;
  observedAt: string;
  fetchedAt: string;
  source: "open-meteo";
  sourceUrl: string;
  current: {
    temperatureC: number | null;
    feelsLikeC: number | null;
    humidityPct: number | null;
    windKph: number | null;
    windDirectionDeg: number | null;
    precipitationMm: number | null;
    rainProbabilityPct: number | null;
    conditionCode: number;
    conditionText: string;
  };
  daily: WeatherDay[];
  hourly: WeatherHour[];
  alerts: WeatherAlert[];
}

export type WeatherOutcome =
  | { ok: true; snapshot: WeatherSnapshot }
  | { ok: false; reason: "unavailable" | "invalid_location"; message: string };

const cache = new Map<string, { at: number; value: WeatherSnapshot }>();

function cacheKey(lat: number, lon: number) {
  return `${lat.toFixed(2)},${lon.toFixed(2)}`;
}

/** WMO weather interpretation codes used by Open-Meteo. */
export function weatherCodeText(code: number): string {
  const table: Record<number, string> = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };
  return table[code] ?? "Unknown conditions";
}

function numeric(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildAlerts(input: {
  current: WeatherSnapshot["current"];
  today: WeatherDay | undefined;
  nextThreeDays: WeatherDay[];
}): WeatherAlert[] {
  const alerts: WeatherAlert[] = [];
  const { current, today, nextThreeDays } = input;

  const rainChance = today?.rainProbabilityPct ?? current.rainProbabilityPct;
  if (rainChance !== null && rainChance >= 60) {
    alerts.push({
      code: "rain_today",
      severity: "info",
      detail: `${Math.round(rainChance)}%`,
    });
  }
  const rainSum = today?.precipitationSumMm ?? null;
  if (rainSum !== null && rainSum >= 35) {
    alerts.push({ code: "heavy_rain", severity: "warning", detail: `${Math.round(rainSum)} mm` });
  }
  if (current.windKph !== null && current.windKph >= 30) {
    alerts.push({
      code: "high_wind",
      severity: current.windKph >= 45 ? "warning" : "info",
      detail: `${Math.round(current.windKph)} km/h`,
    });
  }
  if (today?.tempMaxC !== null && today?.tempMaxC !== undefined && today.tempMaxC >= 38) {
    alerts.push({ code: "heat", severity: today.tempMaxC >= 42 ? "warning" : "info", detail: `${Math.round(today.tempMaxC)}°C` });
  }
  if (current.humidityPct !== null && current.humidityPct >= 85 && (current.temperatureC ?? 0) >= 22) {
    alerts.push({ code: "humidity", severity: "info", detail: `${Math.round(current.humidityPct)}%` });
  }
  if (
    current.windKph !== null &&
    current.windKph >= 20 &&
    (rainChance ?? 0) >= 40
  ) {
    alerts.push({ code: "spray_caution", severity: "warning", detail: "" });
  }
  const dryDays = nextThreeDays.filter((day) => (day.precipitationSumMm ?? 0) < 0.5).length;
  if (dryDays === 3 && nextThreeDays.length === 3) {
    alerts.push({ code: "dry_spell", severity: "info", detail: "" });
  }
  return alerts;
}

/**
 * The exact Open-Meteo request X-FARM AI makes, as a pure function so the server
 * and the browser-fallback build an identical URL (Open-Meteo is CORS-enabled).
 */
export function forecastUrl(latitude: number, longitude: number): string {
  const params = new URLSearchParams({
    latitude: latitude.toFixed(4),
    longitude: longitude.toFixed(4),
    current: [
      "temperature_2m",
      "relative_humidity_2m",
      "apparent_temperature",
      "precipitation",
      "weather_code",
      "wind_speed_10m",
      "wind_direction_10m",
    ].join(","),
    hourly: ["temperature_2m", "precipitation_probability", "precipitation"].join(","),
    daily: [
      "weather_code",
      "temperature_2m_max",
      "temperature_2m_min",
      "precipitation_sum",
      "precipitation_probability_max",
      "wind_speed_10m_max",
    ].join(","),
    timezone: "auto",
    forecast_days: "7",
    wind_speed_unit: "kmh",
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

export interface OpenMeteoPayload {
  timezone?: string;
  current?: Record<string, unknown>;
  hourly?: Record<string, unknown>;
  daily?: Record<string, unknown>;
}

/**
 * Pure mapping from the Open-Meteo response to the snapshot the UI renders.
 * Every value comes from the provider or is null — nothing is estimated here.
 */
export function buildSnapshot(
  payload: OpenMeteoPayload,
  latitude: number,
  longitude: number,
  observedAt = new Date().toISOString(),
): WeatherSnapshot {
  const currentBlock = payload.current ?? {};
  const currentCode = numeric(currentBlock.weather_code) ?? 0;

  const hourlyTimes = (payload.hourly?.time as string[] | undefined) ?? [];
  const hourlyTemps = (payload.hourly?.temperature_2m as number[] | undefined) ?? [];
  const hourlyRain = (payload.hourly?.precipitation_probability as number[] | undefined) ?? [];
  const hourlyPrecip = (payload.hourly?.precipitation as number[] | undefined) ?? [];
  const nowIso = observedAt;
  const upcoming: WeatherHour[] = hourlyTimes
    .map((time, index) => ({
      time,
      temperatureC: numeric(hourlyTemps[index]),
      rainProbabilityPct: numeric(hourlyRain[index]),
      precipitationMm: numeric(hourlyPrecip[index]),
    }))
    .filter((hour) => new Date(hour.time).getTime() >= Date.now() - 60 * 60 * 1000)
    .slice(0, 24);

  const dailyTimes = (payload.daily?.time as string[] | undefined) ?? [];
  const dailyCodes = (payload.daily?.weather_code as number[] | undefined) ?? [];
  const dailyMax = (payload.daily?.temperature_2m_max as number[] | undefined) ?? [];
  const dailyMin = (payload.daily?.temperature_2m_min as number[] | undefined) ?? [];
  const dailyRainSum = (payload.daily?.precipitation_sum as number[] | undefined) ?? [];
  const dailyRainChance = (payload.daily?.precipitation_probability_max as number[] | undefined) ?? [];
  const dailyWind = (payload.daily?.wind_speed_10m_max as number[] | undefined) ?? [];

  const daily: WeatherDay[] = dailyTimes.map((date, index) => ({
    date,
    conditionCode: numeric(dailyCodes[index]) ?? 0,
    conditionText: weatherCodeText(numeric(dailyCodes[index]) ?? 0),
    tempMaxC: numeric(dailyMax[index]),
    tempMinC: numeric(dailyMin[index]),
    precipitationSumMm: numeric(dailyRainSum[index]),
    rainProbabilityPct: numeric(dailyRainChance[index]),
    windMaxKph: numeric(dailyWind[index]),
  }));

  const todayRainChance = daily[0]?.rainProbabilityPct ?? null;
  const currentRainChance =
    todayRainChance !== null
      ? todayRainChance
      : upcoming.length > 0
        ? upcoming.slice(0, 6).reduce<number | null>((best, hour) => {
            if (hour.rainProbabilityPct === null) return best;
            return best === null ? hour.rainProbabilityPct : Math.max(best, hour.rainProbabilityPct);
          }, null)
        : null;

  const current: WeatherSnapshot["current"] = {
    temperatureC: numeric(currentBlock.temperature_2m),
    feelsLikeC: numeric(currentBlock.apparent_temperature),
    humidityPct: numeric(currentBlock.relative_humidity_2m),
    windKph: numeric(currentBlock.wind_speed_10m),
    windDirectionDeg: numeric(currentBlock.wind_direction_10m),
    precipitationMm: numeric(currentBlock.precipitation),
    rainProbabilityPct: currentRainChance,
    conditionCode: currentCode,
    conditionText: weatherCodeText(currentCode),
  };

  const snapshot: WeatherSnapshot = {
    latitude,
    longitude,
    timezone: payload.timezone ?? "auto",
    observedAt: nowIso,
    fetchedAt: nowIso,
    source: "open-meteo",
    sourceUrl: "https://open-meteo.com/",
    current,
    daily,
    hourly: upcoming,
    alerts: buildAlerts({ current, today: daily[0], nextThreeDays: daily.slice(1, 4) }),
  };

  return snapshot;
}

export async function fetchWeather(latitude: number, longitude: number): Promise<WeatherOutcome> {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return { ok: false, reason: "invalid_location", message: "That location is not valid." };
  }

  const key = cacheKey(latitude, longitude);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { ok: true, snapshot: cached.value };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(forecastUrl(latitude, longitude), {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return { ok: false, reason: "unavailable", message: "Weather data is temporarily unavailable." };
    }

    const snapshot = buildSnapshot((await response.json()) as OpenMeteoPayload, latitude, longitude);
    cache.set(key, { at: Date.now(), value: snapshot });
    return { ok: true, snapshot };
  } catch {
    return { ok: false, reason: "unavailable", message: "Weather data is temporarily unavailable." };
  } finally {
    clearTimeout(timer);
  }
}
