/**
 * Live check of every third-party API X-FARM AI talks to.
 *
 *   npm run test:integrations
 *
 * Run this on a host that has normal outbound internet (a laptop, VPS or any
 * PaaS) — it makes one small real request per provider and proves the
 * credentials actually work, rather than only that the variables are set:
 *
 *   • Open-Meteo   — the weather endpoint the server uses.
 *   • Gemini       — model listing + one tiny generateContent call.
 *   • Mapbox       — one geocoding request with the public token.
 *   • data.gov.in  — one-row Agmarknet mandi price request (optional).
 *
 * Keys are never printed — only masked prefixes, lengths and HTTP statuses.
 * Exits non-zero when a *configured* integration fails, so it can gate a deploy.
 */

import "./env";

const MASK = (name: string) => {
  const value = (process.env[name] ?? "").trim();
  if (!value) return "(empty)";
  const head = value.slice(0, 6);
  return `${head}… (${value.length} chars)`;
};

const GEMINI_KEY = (process.env.GEMINI_API_KEY ?? "").trim();
const MAPBOX_TOKEN = (process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "").trim();
const DATA_GOV_KEY = (process.env.DATA_GOV_IN_API_KEY ?? "").trim();
const GEMINI_MODEL = (process.env.GEMINI_MODEL ?? "").trim() || "gemini-2.5-flash";
const GEMINI_BASE = (process.env.GEMINI_API_BASE ?? "").trim() || "https://generativelanguage.googleapis.com/v1beta";
const MANDI_RESOURCE = (process.env.DATA_GOV_MANDI_RESOURCE_ID ?? "").trim() || "9ef84268-d588-465a-a308-a864a43d0070";

const TIMEOUT_MS = 20_000;
let failures = 0;

function pass(label: string, detail = "") {
  console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ""}`);
}

function fail(label: string, detail: string) {
  failures += 1;
  console.log(`  ✗ ${label} — ${detail}`);
}

function skip(label: string, variable: string) {
  console.log(`  · ${label} — ${variable} is not set, skipped`);
}

async function request(url: string, init: RequestInit = {}): Promise<{ status: number; ok: boolean; body: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, cache: "no-store" });
    const body = await response.text();
    return { status: response.status, ok: response.ok, body };
  } finally {
    clearTimeout(timer);
  }
}

function parse<T>(body: string): T | null {
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

async function checkOpenMeteo() {
  console.log("\nOpen-Meteo (weather, no key required)");
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast?latitude=16.5062&longitude=80.6480" +
      "&current=temperature_2m,relative_humidity_2m,wind_speed_10m&timezone=auto";
    const response = await request(url, { headers: { Accept: "application/json" } });
    const payload = parse<{ current?: { temperature_2m?: number } }>(response.body);
    const temperature = payload?.current?.temperature_2m;
    if (response.ok && typeof temperature === "number") {
      pass("Vijayawada forecast reachable", `current temperature ${temperature}°C`);
    } else {
      fail("Vijayawada forecast", `HTTP ${response.status}${temperature === undefined ? ", no temperature in payload" : ""}`);
    }
  } catch (error) {
    fail("forecast request", error instanceof Error ? error.message : "unknown error");
  }
}

async function checkGemini() {
  console.log("\nGemini (AI assistant, crop photos, crop advice)");
  if (!GEMINI_KEY) {
    skip("Gemini", "GEMINI_API_KEY");
    return;
  }
  console.log(`  key: ${MASK("GEMINI_API_KEY")} · model: ${GEMINI_MODEL}`);

  // 1. The key must be accepted at all. New AI Studio keys (`AQ.`) only work
  //    when sent in the x-goog-api-key header — which is what the app does.
  try {
    const response = await request(`${GEMINI_BASE}/models?pageSize=50`, {
      headers: { "x-goog-api-key": GEMINI_KEY, Accept: "application/json" },
    });
    if (response.status === 401 || response.status === 403) {
      fail("key rejected", `HTTP ${response.status} — create a fresh key at https://aistudio.google.com/apikey`);
    } else if (response.status === 404) {
      fail("key rejected", "HTTP 404 — this key format must be sent in the x-goog-api-key header, not ?key=");
    } else if (!response.ok) {
      fail("model listing", `HTTP ${response.status} ${response.body.slice(0, 120)}`);
    } else {
      const payload = parse<{ models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> }>(response.body);
      const names = (payload?.models ?? [])
        .map((model) => (model.name ?? "").replace(/^models\//, ""))
        .filter((name) => name.includes("flash") || name.includes("pro"));
      pass("key accepted", `${payload?.models?.length ?? 0} models available`);
      if (names.length > 0) console.log(`    e.g. ${names.slice(0, 4).join(", ")}`);
      if (!names.includes(GEMINI_MODEL)) {
        console.log(`    note: ${GEMINI_MODEL} is not in the list — set GEMINI_MODEL to one that is`);
      }
    }
  } catch (error) {
    fail("model listing", error instanceof Error ? error.message : "unknown error");
  }

  // 2. A real generation, the same call path the assistant uses.
  try {
    const response = await request(`${GEMINI_BASE}/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: "Reply with exactly: X-FARM AI online." }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 32 },
      }),
    });
    const payload = parse<{
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      error?: { message?: string };
    }>(response.body);
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (response.ok && text) {
      pass(`${GEMINI_MODEL} generation`, JSON.stringify(text.slice(0, 60)));
    } else {
      fail(`${GEMINI_MODEL} generation`, `HTTP ${response.status} ${payload?.error?.message?.slice(0, 140) ?? ""}`);
    }
  } catch (error) {
    fail("generation request", error instanceof Error ? error.message : "unknown error");
  }
}

async function checkMapbox() {
  console.log("\nMapbox (map tiles, satellite, address search)");
  if (!MAPBOX_TOKEN) {
    skip("Mapbox", "NEXT_PUBLIC_MAPBOX_TOKEN");
    return;
  }
  console.log(`  token: ${MASK("NEXT_PUBLIC_MAPBOX_TOKEN")}`);
  if (!MAPBOX_TOKEN.startsWith("pk.")) {
    fail("token type", "NEXT_PUBLIC_MAPBOX_TOKEN must be a public token starting with pk. — a secret sk. token must never reach the browser");
  } else {
    pass("token is a public pk. token");
  }

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: "5",
      country: "in",
      proximity: "80.6480,16.5062",
    });
    const response = await request(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent("Vijayawada")}.json?${params.toString()}`,
      { headers: { Accept: "application/json" } },
    );
    const payload = parse<{ features?: Array<{ place_name?: string }>; message?: string }>(response.body);
    if (response.ok && (payload?.features?.length ?? 0) > 0) {
      pass("geocoding works", payload?.features?.[0]?.place_name ?? "");
    } else {
      fail("geocoding", `HTTP ${response.status} ${payload?.message?.slice(0, 140) ?? ""}`);
    }
  } catch (error) {
    fail("geocoding request", error instanceof Error ? error.message : "unknown error");
  }

  // Tiles are fetched by the visitor's browser, so only the style metadata is
  // checked here — it proves the token is allowed to draw the map.
  try {
    const response = await request(
      `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${encodeURIComponent(MAPBOX_TOKEN)}`,
      { headers: { Accept: "application/json" } },
    );
    if (response.ok) pass("satellite-streets style reachable");
    else fail("style", `HTTP ${response.status}`);
  } catch (error) {
    fail("style request", error instanceof Error ? error.message : "unknown error");
  }
}

async function checkDataGov() {
  console.log("\nData.gov.in (real Agmarknet mandi prices — optional)");
  if (!DATA_GOV_KEY) {
    skip("Price import", "DATA_GOV_IN_API_KEY");
    return;
  }
  console.log(`  key: ${MASK("DATA_GOV_IN_API_KEY")} · resource: ${MANDI_RESOURCE}`);
  try {
    const params = new URLSearchParams({ "api-key": DATA_GOV_KEY, format: "json", limit: "1", offset: "0" });
    const response = await request(`https://api.data.gov.in/resource/${MANDI_RESOURCE}?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });
    const payload = parse<{ total?: number; records?: unknown[]; message?: string }>(response.body);
    if (response.ok && Array.isArray(payload?.records)) {
      pass("mandi price feed reachable", `records returned: ${payload?.records.length}, total available: ${payload?.total ?? "unknown"}`);
    } else {
      fail("mandi price feed", `HTTP ${response.status} ${payload?.message?.slice(0, 140) ?? response.body.slice(0, 140)}`);
    }
  } catch (error) {
    fail("price request", error instanceof Error ? error.message : "unknown error");
  }
}

async function main() {
  console.log("X-FARM AI — live integration check");
  console.log("Leave GEMINI_API_KEY / NEXT_PUBLIC_MAPBOX_TOKEN / DATA_GOV_IN_API_KEY empty to skip a provider.");

  await checkOpenMeteo();
  await checkGemini();
  await checkMapbox();
  await checkDataGov();

  console.log(
    failures === 0
      ? "\nAll configured integrations answered. Weather, AI and the map will work on this host."
      : `\n${failures} integration check(s) failed — see the notes above.`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

void main();
