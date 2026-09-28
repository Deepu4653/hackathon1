/**
 * Single place the UI asks "is this integration configured?".
 * Server-only: it reads both public and private env, so it must never be
 * imported into a client component.
 */
import { isMapboxConfigured, isSupabaseConfigured } from "@/lib/env";
import { isGeminiConfigured } from "@/lib/gemini";
import { isPriceImportConfigured } from "@/lib/market/service";

export { isMapboxConfigured, isSupabaseConfigured, isGeminiConfigured, isPriceImportConfigured };

export interface IntegrationSnapshot {
  supabase: boolean;
  gemini: boolean;
  mapbox: boolean;
  marketPrices: boolean;
  smtp: boolean;
}

export function integrationSnapshot(): IntegrationSnapshot {
  return {
    supabase: isSupabaseConfigured(),
    gemini: isGeminiConfigured(),
    mapbox: isMapboxConfigured(),
    marketPrices: isPriceImportConfigured(),
    smtp: Boolean(process.env.SMTP_URL?.trim()),
  };
}

/** Names (never values) of the environment variables a deployment still needs. */
export function missingIntegrationVariables(): string[] {
  const snapshot = integrationSnapshot();
  const missing: string[] = [];
  if (!snapshot.supabase) missing.push("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!snapshot.gemini) missing.push("GEMINI_API_KEY");
  if (!snapshot.mapbox) missing.push("NEXT_PUBLIC_MAPBOX_TOKEN");
  if (!snapshot.marketPrices) missing.push("DATA_GOV_IN_API_KEY (optional — market price import)");
  if (!snapshot.smtp) missing.push("SMTP_URL (optional — password reset email)");
  return missing;
}
