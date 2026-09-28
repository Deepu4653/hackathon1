import { createBrowserClient } from "@supabase/ssr";
import { publicEnv, isSupabaseConfigured } from "@/lib/env";

/**
 * Browser Supabase client. Used only for client-side auth helpers (session
 * listener, OAuth-style flows). All data mutations go through server code.
 * The anon key is public by design; the service-role key is never present here.
 */
export function createSupabaseBrowserClient() {
  if (!isSupabaseConfigured()) return null;
  return createBrowserClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
