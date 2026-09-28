import { NextResponse } from "next/server";
import { dataBackend, isMapboxConfigured, isSupabaseConfigured } from "@/lib/env";
import { integrationStatus } from "@/lib/env.server";
import { isGeminiConfigured } from "@/lib/gemini";

/**
 * Deployment diagnostics. Reports which integrations are configured WITHOUT
 * ever echoing a secret — it only says whether a credential is present.
 */
export async function GET() {
  const checks: Record<string, boolean> = {
    supabase: isSupabaseConfigured(),
    serviceRole: integrationStatus.supabaseServiceRole,
    gemini: isGeminiConfigured(),
    mapbox: isMapboxConfigured(),
    marketPrices: integrationStatus.dataGov,
  };

  let database: "ok" | "error" = "ok";
  let databaseDetail = "";
  try {
    const { getDataClient } = await import("@/lib/db");
    const db = await getDataClient();
    const { error } = await db.from("categories").select("id", { count: "exact", head: true }).limit(1);
    if (error) {
      database = "error";
      databaseDetail = error.message;
    }
  } catch (error) {
    database = "error";
    databaseDetail = error instanceof Error ? error.message : "unknown error";
  }

  return NextResponse.json(
    {
      ok: database === "ok",
      backend: dataBackend(),
      database,
      databaseDetail: databaseDetail || undefined,
      integrations: checks,
      missing: Object.entries(checks)
        .filter(([, present]) => !present)
        .map(([name]) => name),
      timestamp: new Date().toISOString(),
    },
    { status: database === "ok" ? 200 : 503 },
  );
}
