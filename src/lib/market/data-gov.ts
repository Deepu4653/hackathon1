/**
 * Official mandi price import — data.gov.in (Agmarknet).
 *
 * X-FARM AI never invents a price. This module is the ONLY writer of
 * `market_prices` besides an administrator's own manual entry, and every row it
 * writes carries the source name, source URL and price date.
 *
 * Requires DATA_GOV_IN_API_KEY (free registration at data.gov.in). Without it the
 * import reports `not_configured` and the UI explains how to enable it.
 */

import { serverEnv } from "@/lib/env.server";

const TIMEOUT_MS = 25_000;

export interface AgmarknetRow {
  cropName: string;
  variety: string | null;
  marketName: string;
  district: string | null;
  state: string | null;
  minPrice: number | null;
  maxPrice: number | null;
  modalPrice: number;
  priceDate: string | null;
  source: string;
  sourceUrl: string;
}

export type ImportOutcome =
  | { ok: true; rows: AgmarknetRow[]; message?: string }
  | { ok: false; reason: "not_configured" | "unavailable" | "empty"; message: string };

export function isPriceImportConfigured(): boolean {
  return Boolean(serverEnv.dataGovApiKey);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Converts Agmarknet's dd/mm/yyyy arrival_date into an ISO date. */
function parseDate(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parts = value.trim().split(/[/-]/);
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day.length <= 2 && month.length <= 2 && year.length === 4) {
      const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      if (!Number.isNaN(Date.parse(iso))) return iso;
    }
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function fetchAgmarknetPrices(options: {
  state?: string;
  district?: string;
  limit?: number;
}): Promise<ImportOutcome> {
  if (!isPriceImportConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message: "DATA_GOV_IN_API_KEY is not configured, so no official price feed is available.",
    };
  }

  const params = new URLSearchParams({
    "api-key": serverEnv.dataGovApiKey,
    format: "json",
    limit: String(Math.min(options.limit ?? 500, 1000)),
  });
  // Resource-scoped filters keep the request small and relevant.
  if (options.state) params.set("filters[state.keyword]", options.state);
  if (options.district) params.set("filters[district.keyword]", options.district);

  const url = `https://api.data.gov.in/resource/${serverEnv.dataGovResourceId}?${params.toString()}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "unavailable",
        message: `The official price feed responded with status ${response.status}.`,
      };
    }

    const payload = (await response.json()) as { records?: Record<string, unknown>[] };
    const records = payload.records ?? [];
    if (records.length === 0) {
      return { ok: false, reason: "empty", message: "The official feed returned no rows for that filter." };
    }

    const rows: AgmarknetRow[] = [];
    for (const record of records) {
      const modal = parseNumber(record.modal_price);
      const crop = String(record.commodity ?? "").trim();
      const market = String(record.market ?? "").trim();
      if (!crop || !market || modal === null) continue;

      rows.push({
        cropName: crop,
        variety: record.variety ? String(record.variety).trim() || null : null,
        marketName: market,
        district: record.district ? String(record.district).trim() || null : null,
        state: record.state ? String(record.state).trim() || null : null,
        minPrice: parseNumber(record.min_price),
        maxPrice: parseNumber(record.max_price),
        modalPrice: modal,
        priceDate: parseDate(record.arrival_date),
        source: "data.gov.in — Agmarknet",
        sourceUrl: url.replace(/api-key=[^&]+/, "api-key=***"),
      });
    }

    if (rows.length === 0) {
      return { ok: false, reason: "empty", message: "No usable rows were found in the official feed." };
    }

    return { ok: true, rows };
  } catch {
    return {
      ok: false,
      reason: "unavailable",
      message: "The official price feed is temporarily unavailable.",
    };
  } finally {
    clearTimeout(timer);
  }
}
