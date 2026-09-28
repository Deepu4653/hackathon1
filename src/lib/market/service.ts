import { getDataClient, getServiceDataClient, logAuditEvent } from "@/lib/db";
import type { MarketPrice } from "@/lib/db/types";
import { fetchAgmarknetPrices, isPriceImportConfigured } from "./data-gov";

export { isPriceImportConfigured };

export interface MarketPriceFilters {
  crop?: string;
  district?: string;
  state?: string;
  market?: string;
  limit?: number;
}

export async function listMarketPrices(filters: MarketPriceFilters = {}): Promise<MarketPrice[]> {
  const db = await getDataClient();
  let query = db.from<MarketPrice>("market_prices").select("*");

  if (filters.crop?.trim()) query = query.ilike("crop_name", `%${filters.crop.trim()}%`);
  if (filters.district) query = query.eq("district", filters.district);
  if (filters.state) query = query.eq("state", filters.state);
  if (filters.market) query = query.eq("market_name", filters.market);

  const { data, error } = await query
    .order("price_date", { ascending: false })
    .order("crop_name", { ascending: true })
    .limit(Math.min(filters.limit ?? 60, 200));

  if (error) {
    console.error("[market] list failed:", error.message);
    return [];
  }
  return (data ?? []) as MarketPrice[];
}

export interface PriceTrendPoint {
  date: string;
  averagePrice: number;
  samples: number;
}

/** Real trend: computed only from stored, sourced rows. */
export async function getPriceTrend(cropName: string, district?: string): Promise<PriceTrendPoint[]> {
  const db = await getDataClient();
  let query = db
    .from<MarketPrice>("market_prices")
    .select("price_date,price_per_quintal")
    .ilike("crop_name", `%${cropName}%`);
  if (district) query = query.eq("district", district);

  const { data, error } = await query.order("price_date", { ascending: false }).limit(200);
  if (error || !data) return [];

  const byDate = new Map<string, { total: number; samples: number }>();
  for (const row of data as Array<Pick<MarketPrice, "price_date" | "price_per_quintal">>) {
    const value = Number(row.price_per_quintal);
    if (!Number.isFinite(value)) continue;
    const entry = byDate.get(row.price_date) ?? { total: 0, samples: 0 };
    entry.total += value;
    entry.samples += 1;
    byDate.set(row.price_date, entry);
  }

  return Array.from(byDate.entries())
    .map(([date, entry]) => ({
      date,
      averagePrice: Math.round(entry.total / entry.samples),
      samples: entry.samples,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

export async function listPriceDistricts(): Promise<string[]> {
  const db = await getDataClient();
  const { data } = await db
    .from<MarketPrice>("market_prices")
    .select("district")
    .not("district", "is", null)
    .limit(200);
  const districts = new Set<string>();
  for (const row of (data ?? []) as Array<Pick<MarketPrice, "district">>) {
    if (row.district) districts.add(row.district);
  }
  return Array.from(districts).sort();
}

export interface ImportSummary {
  ok: boolean;
  imported: number;
  skipped: number;
  reason?: "not_configured" | "unavailable" | "empty";
  message: string;
}

/**
 * Imports official prices. Only administrators call this (the server action
 * checks the role first), and every row is written with its source attribution.
 */
export async function importMarketPrices(options: {
  actorId: string;
  state?: string;
  district?: string;
  limit?: number;
}): Promise<ImportSummary> {
  const outcome = await fetchAgmarknetPrices({
    state: options.state ?? "Andhra Pradesh",
    district: options.district,
    limit: options.limit ?? 500,
  });

  if (!outcome.ok) {
    await recordImport(options.actorId, {
      status: "failed",
      rowCount: 0,
      message: outcome.message,
    });
    return { ok: false, imported: 0, skipped: 0, reason: outcome.reason, message: outcome.message };
  }

  const service = await getServiceDataClient();
  let imported = 0;
  let skipped = 0;

  for (const row of outcome.rows) {
    const { error } = await service.from("market_prices").upsert(
      {
        crop_name: row.cropName,
        variety: row.variety,
        market_name: row.marketName,
        district: row.district,
        state: row.state,
        price_per_quintal: row.modalPrice,
        min_price: row.minPrice,
        max_price: row.maxPrice,
        unit: "INR/quintal",
        price_date: row.priceDate ?? new Date().toISOString().slice(0, 10),
        source: row.source,
        source_url: row.sourceUrl,
        is_verified: true,
        imported_by: options.actorId,
      },
      { onConflict: "crop_name,market_name,price_date,source" },
    );
    if (error) skipped += 1;
    else imported += 1;
  }

  await recordImport(options.actorId, {
    status: skipped === 0 ? "success" : imported > 0 ? "partial" : "failed",
    rowCount: imported,
    message: `${imported} rows imported, ${skipped} skipped.`,
  });
  await logAuditEvent({
    action: "admin.import_market_prices",
    entity: "market_prices",
    actorId: options.actorId,
    meta: { imported, skipped },
  });

  return {
    ok: imported > 0,
    imported,
    skipped,
    message: `${imported} price rows imported${skipped ? `, ${skipped} skipped` : ""}.`,
  };
}

async function recordImport(
  actorId: string,
  input: { status: "success" | "partial" | "failed"; rowCount: number; message: string },
): Promise<void> {
  try {
    const service = await getServiceDataClient();
    await service.from("market_price_imports").insert({
      imported_by: actorId,
      source: "data.gov.in — Agmarknet",
      source_url: "https://data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070",
      price_date: new Date().toISOString().slice(0, 10),
      row_count: input.rowCount,
      status: input.status,
      message: input.message,
    });
  } catch {
    // The import itself already succeeded or failed on its own merits.
  }
}
