import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { DataClient } from "@/lib/db/client";

/**
 * SERVICE-ROLE client. Server-side only.
 *
 * Used exclusively for audited administrative operations that genuinely need to
 * bypass RLS (for example: promoting the first administrator configured through
 * ADMIN_EMAILS, moderation actions, market-price imports). It is never imported
 * by client components and the key is never exposed with NEXT_PUBLIC_.
 */
let adminClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  if (!isSupabaseConfigured() || !serverEnv.supabaseServiceRoleKey) return null;
  if (!adminClient) {
    adminClient = createClient(publicEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { "x-xfarm-context": "service-role" } },
    });
  }
  return adminClient;
}

export function createSupabaseAdminDataClient(): DataClient | null {
  const client = getSupabaseAdminClient();
  if (!client) return null;
  return {
    backend: "supabase",
    from: (table: string) => client.from(table),
    rpc: (fn: string, params?: Record<string, unknown>) => client.rpc(fn, params),
  } as unknown as DataClient;
}
