import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";
import type { DataClient } from "@/lib/db/client";

/**
 * Cookie-bound Supabase client for Server Components, Server Actions and
 * Route Handlers. Every statement runs as the signed-in user, so Supabase RLS
 * (see supabase/migrations/0007_row_level_security.sql) is the enforcement
 * layer — application code never needs to trust the client.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component render: Next.js forbids cookie writes.
          // Session refresh happens in middleware / route handlers instead.
        }
      },
    },
  });
}

/**
 * The Supabase client satisfies the X-FARM data interface; this adapter keeps
 * the repositories backend-agnostic.
 */
export async function createSupabaseDataClient(): Promise<DataClient> {
  const client = await createSupabaseServerClient();
  return {
    backend: "supabase",
    from: (table: string) => client.from(table),
    rpc: (fn: string, params?: Record<string, unknown>) => client.rpc(fn, params),
  } as unknown as DataClient;
}
